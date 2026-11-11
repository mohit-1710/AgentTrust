//! Account-owned service identities and issuer-scoped capability assertions.
use crate::types::{AccountId, Hash32, PublicKey32, U64String};
use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

pub const MAX_ISSUED_CREDENTIALS: u32 = 32;
pub const CREDENTIAL_CLOCK_SKEW_NS: u64 = 5_000_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RegistryError {
    Unauthorized,
    VersionMismatch,
    RevisionMismatch,
    RevisionOverflow,
    CredentialMissing,
    InvalidSubject,
    InvalidScope,
    InvalidSuite,
    InvalidDates,
    Capacity,
}
impl RegistryError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Unauthorized => "UNAUTHORIZED",
            Self::VersionMismatch => "IDENTITY_CHANGED",
            Self::RevisionMismatch => "REVISION_CHANGED",
            Self::RevisionOverflow => "REVISION_OVERFLOW",
            Self::CredentialMissing => "CREDENTIAL_MISSING",
            Self::InvalidSubject => "INVALID_SUBJECT",
            Self::InvalidScope => "INVALID_SCOPE",
            Self::InvalidSuite => "INVALID_SUITE",
            Self::InvalidDates => "INVALID_DATES",
            Self::Capacity => "CAPACITY",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct ServiceIdentity {
    pub service_id: AccountId,
    pub version: u32,
    pub payout_account: AccountId,
    pub invoice_key: PublicKey32,
    pub endpoint_hash: Hash32,
    pub active: bool,
}

pub struct ServiceUpdate {
    pub payout_account: AccountId,
    pub invoice_key: PublicKey32,
    pub endpoint_hash: Hash32,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
#[serde(deny_unknown_fields)]
pub struct CredentialAssertion {
    pub service_id: AccountId,
    pub service_version: u32,
    pub capability_namespace: String,
    pub capability_version: u32,
    pub conformance_suite_version: u32,
    pub conformance_suite_hash: Hash32,
    pub evidence_manifest_hash: Hash32,
    pub issued_at_ns: U64String,
    pub expires_at_ns: U64String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
#[serde(deny_unknown_fields)]
pub struct CredentialRef {
    pub issuer_id: AccountId,
    pub credential_id: Hash32,
    pub revision: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct Credential {
    pub issuer_id: AccountId,
    pub credential_id: Hash32,
    pub revision: u32,
    pub revoked: bool,
    #[serde(flatten)]
    pub assertion: CredentialAssertion,
}
impl Credential {
    pub fn reference(&self) -> CredentialRef {
        CredentialRef {
            issuer_id: self.issuer_id.clone(),
            credential_id: self.credential_id,
            revision: self.revision,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CredentialIssue {
    pub credential: Credential,
    pub retained_count: u32,
}

pub fn set_service(
    merchant_id: &AccountId,
    existing: Option<&ServiceIdentity>,
    expected_version: Option<u32>,
    update: ServiceUpdate,
) -> Result<ServiceIdentity, RegistryError> {
    let version = match existing {
        Some(current) => {
            if current.service_id != *merchant_id {
                return Err(RegistryError::Unauthorized);
            }
            if expected_version != Some(current.version) {
                return Err(RegistryError::VersionMismatch);
            }
            current
                .version
                .checked_add(1)
                .ok_or(RegistryError::RevisionOverflow)?
        }
        None => {
            if expected_version.is_some() {
                return Err(RegistryError::VersionMismatch);
            }
            1
        }
    };
    Ok(ServiceIdentity {
        service_id: merchant_id.clone(),
        version,
        payout_account: update.payout_account,
        invoice_key: update.invoice_key,
        endpoint_hash: update.endpoint_hash,
        active: update.active,
    })
}

pub fn issue_credential(
    issuer_id: &AccountId,
    credential_id: Hash32,
    existing: Option<&Credential>,
    expected_revision: Option<u32>,
    retained_count: u32,
    assertion: CredentialAssertion,
    service: Option<&ServiceIdentity>,
    now_ns: u64,
) -> Result<CredentialIssue, RegistryError> {
    let (revision, retained_count) = match existing {
        Some(current) => {
            if current.issuer_id != *issuer_id || current.credential_id != credential_id {
                return Err(RegistryError::Unauthorized);
            }
            if expected_revision != Some(current.revision) {
                return Err(RegistryError::RevisionMismatch);
            }
            (
                current
                    .revision
                    .checked_add(1)
                    .ok_or(RegistryError::RevisionOverflow)?,
                retained_count,
            )
        }
        None => {
            if expected_revision.is_some() {
                return Err(RegistryError::RevisionMismatch);
            }
            if retained_count >= MAX_ISSUED_CREDENTIALS {
                return Err(RegistryError::Capacity);
            }
            (1, retained_count + 1)
        }
    };
    let service = service.ok_or(RegistryError::InvalidSubject)?;
    if !service.active
        || service.service_id != assertion.service_id
        || service.version != assertion.service_version
    {
        return Err(RegistryError::InvalidSubject);
    }
    if assertion.capability_namespace != "invoice.audit" || assertion.capability_version != 1 {
        return Err(RegistryError::InvalidScope);
    }
    if assertion.conformance_suite_version == 0 {
        return Err(RegistryError::InvalidSuite);
    }
    if !credential_dates_valid(&assertion, now_ns) {
        return Err(RegistryError::InvalidDates);
    }
    Ok(CredentialIssue {
        credential: Credential {
            issuer_id: issuer_id.clone(),
            credential_id,
            revision,
            revoked: false,
            assertion,
        },
        retained_count,
    })
}

/// Revocation changes status, not the assertion revision. Only explicit renewal
/// creates a new assertion revision; an old reference can distinguish the two.
pub fn revoke_credential(
    issuer_id: &AccountId,
    credential_id: Hash32,
    existing: Option<&Credential>,
) -> Result<Credential, RegistryError> {
    let current = existing.ok_or(RegistryError::CredentialMissing)?;
    if current.issuer_id != *issuer_id || current.credential_id != credential_id {
        return Err(RegistryError::Unauthorized);
    }
    let mut revoked = current.clone();
    revoked.revoked = true;
    Ok(revoked)
}

/// Five seconds of issue-time skew, strict expiry, no hidden lifetime extension.
pub fn credential_dates_valid(assertion: &CredentialAssertion, now_ns: u64) -> bool {
    assertion.issued_at_ns.0 <= now_ns.saturating_add(CREDENTIAL_CLOCK_SKEW_NS)
        && assertion.expires_at_ns.0 > assertion.issued_at_ns.0
        && assertion.expires_at_ns.0 > now_ns
}
