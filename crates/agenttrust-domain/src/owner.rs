//! Bounded owner settings over ordinary values; no storage or chain runtime.
use crate::{
    authority::AuthorityError,
    types::{AccountId, Hash32, ProfileId, U64String, U128String},
};
use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const MAX_PROFILES: usize = 4;
pub const MAX_SESSIONS: usize = 8;
pub const MAX_ACCEPTED_ISSUERS: usize = 4;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
#[serde(deny_unknown_fields)]
pub struct CapabilityRequirement {
    pub capability_namespace: String,
    pub capability_version: u32,
    pub conformance_suite_version: u32,
    pub conformance_suite_hash: Hash32,
    pub accepted_issuers: Vec<AccountId>,
}
impl CapabilityRequirement {
    pub fn validate(&self) -> Result<(), AuthorityError> {
        if self.capability_namespace != "invoice.audit"
            || self.capability_version != 1
            || self.conformance_suite_version == 0
            || self.accepted_issuers.is_empty()
            || self.accepted_issuers.len() > MAX_ACCEPTED_ISSUERS
        {
            return Err(AuthorityError::InvalidProfile);
        }
        for (index, issuer) in self.accepted_issuers.iter().enumerate() {
            if self.accepted_issuers[..index].contains(issuer) {
                return Err(AuthorityError::InvalidProfile);
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct OwnerPolicy {
    pub revision: u32,
    pub paused: bool,
    pub daily_cap_yocto: U128String,
    pub max_dispatches_per_minute: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct Profile {
    pub profile_id: ProfileId,
    pub revision: u32,
    pub requirement: Option<CapabilityRequirement>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct Session {
    pub session_id: Hash32,
    pub public_key: String,
    pub profile_id: ProfileId,
    pub profile_revision: u32,
    pub purchase_cap_yocto: U128String,
    pub expires_at_ns: U64String,
    pub revoked: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, BorshSerialize, BorshDeserialize)]
pub struct AccountLedger {
    pub available_yocto: U128String,
    pub storage_credit_yocto: U128String,
    pub pending_payment_yocto: U128String,
    pub storage_charged_bytes: U64String,
}

#[derive(Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
pub struct ActorState {
    pub owner_id: AccountId,
    pub ledger: AccountLedger,
    pub policy: OwnerPolicy,
    pub profiles: BTreeMap<ProfileId, Profile>,
    pub sessions: BTreeMap<Hash32, Session>,
}

pub struct SessionRegistration {
    pub session_id: Hash32,
    /// Obtained from a validated native PublicKey at the contract boundary.
    pub public_key: String,
    pub profile_id: ProfileId,
    pub profile_revision: u32,
    pub purchase_cap_yocto: U128String,
    pub expires_at_ns: U64String,
}

impl ActorState {
    /// Only the funded deposit path may persist a newly created actor.
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            ledger: AccountLedger::default(),
            policy: OwnerPolicy {
                revision: 0,
                paused: true,
                daily_cap_yocto: U128String(0),
                max_dispatches_per_minute: 0,
            },
            profiles: BTreeMap::new(),
            sessions: BTreeMap::new(),
        }
    }

    /// Charge measured growth only. Shrinkage is not a spendable-credit refund.
    pub fn charge_storage_growth(
        &mut self,
        growth_bytes: u64,
        cost_per_byte: u128,
    ) -> Result<u128, AuthorityError> {
        let charge = u128::from(growth_bytes)
            .checked_mul(cost_per_byte)
            .ok_or(AuthorityError::ArithmeticOverflow)?;
        let credit = self
            .ledger
            .storage_credit_yocto
            .0
            .checked_sub(charge)
            .ok_or(AuthorityError::StorageCredit)?;
        let charged_bytes = self
            .ledger
            .storage_charged_bytes
            .0
            .checked_add(growth_bytes)
            .ok_or(AuthorityError::ArithmeticOverflow)?;
        self.ledger.storage_credit_yocto = U128String(credit);
        self.ledger.storage_charged_bytes = U64String(charged_bytes);
        Ok(charge)
    }
    pub fn set_policy(
        &mut self,
        expected_revision: u32,
        daily_cap_yocto: U128String,
        max_dispatches_per_minute: u32,
        paused: bool,
    ) -> Result<OwnerPolicy, AuthorityError> {
        if self.policy.revision != expected_revision {
            return Err(AuthorityError::RevisionMismatch);
        }
        let revision = next_revision(self.policy.revision)?;
        self.policy = OwnerPolicy {
            revision,
            paused,
            daily_cap_yocto,
            max_dispatches_per_minute,
        };
        Ok(self.policy.clone())
    }
    pub fn set_profile(
        &mut self,
        profile_id: ProfileId,
        expected_revision: Option<u32>,
        requirement: Option<CapabilityRequirement>,
    ) -> Result<Profile, AuthorityError> {
        if let Some(requirement) = &requirement {
            requirement.validate()?;
        }
        let revision = match self.profiles.get(&profile_id) {
            Some(existing) => {
                if expected_revision != Some(existing.revision) {
                    return Err(AuthorityError::RevisionMismatch);
                }
                next_revision(existing.revision)?
            }
            None => {
                if expected_revision.is_some() {
                    return Err(AuthorityError::RevisionMismatch);
                }
                if self.profiles.len() >= MAX_PROFILES {
                    return Err(AuthorityError::Capacity);
                }
                1
            }
        };
        let policy_revision = next_revision(self.policy.revision)?;
        let profile = Profile {
            profile_id: profile_id.clone(),
            revision,
            requirement,
        };
        self.profiles.insert(profile_id, profile.clone());
        self.policy.revision = policy_revision;
        Ok(profile)
    }
    pub fn register_session(
        &mut self,
        registration: SessionRegistration,
        now_ns: u64,
    ) -> Result<Session, AuthorityError> {
        if self.sessions.contains_key(&registration.session_id) {
            return Err(AuthorityError::SessionExists);
        }
        if self.sessions.len() >= MAX_SESSIONS {
            return Err(AuthorityError::Capacity);
        }
        let profile = self
            .profiles
            .get(&registration.profile_id)
            .ok_or(AuthorityError::ProfileMismatch)?;
        if profile.revision != registration.profile_revision {
            return Err(AuthorityError::ProfileMismatch);
        }
        if registration.expires_at_ns.0 <= now_ns {
            return Err(AuthorityError::SessionExpired);
        }
        if self
            .sessions
            .values()
            .any(|session| !session.revoked && session.public_key == registration.public_key)
        {
            return Err(AuthorityError::DuplicateActiveKey);
        }
        let policy_revision = next_revision(self.policy.revision)?;
        let session = Session {
            session_id: registration.session_id,
            public_key: registration.public_key,
            profile_id: registration.profile_id,
            profile_revision: registration.profile_revision,
            purchase_cap_yocto: registration.purchase_cap_yocto,
            expires_at_ns: registration.expires_at_ns,
            revoked: false,
        };
        self.sessions.insert(session.session_id, session.clone());
        self.policy.revision = policy_revision;
        Ok(session)
    }
    pub fn revoke_session(&mut self, session_id: &Hash32) -> Result<Session, AuthorityError> {
        let existing = self
            .sessions
            .get(session_id)
            .ok_or(AuthorityError::SessionMissing)?;
        if existing.revoked {
            return Ok(existing.clone());
        }
        let revision = next_revision(self.policy.revision)?;
        let session = self
            .sessions
            .get_mut(session_id)
            .expect("session checked above");
        session.revoked = true;
        self.policy.revision = revision;
        Ok(session.clone())
    }
}

fn next_revision(revision: u32) -> Result<u32, AuthorityError> {
    revision
        .checked_add(1)
        .ok_or(AuthorityError::RevisionOverflow)
}
