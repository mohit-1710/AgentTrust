//! Ordered read-only admission rules. No caller or chain runtime is fabricated here.
use crate::{
    owner::{ActorState, CapabilityRequirement, MAX_ACCEPTED_ISSUERS},
    registry::{Credential, CredentialRef, ServiceIdentity, credential_dates_valid},
    types::{AccountId, InvoiceV1, U64String},
};
use serde::Serialize;

pub const MINUTE_NS: u64 = 60_000_000_000;
pub const DAY_NS: u64 = 86_400_000_000_000;
pub const MAX_OUTSTANDING_TRANSFERS: u32 = 8;
pub const MAX_RETAINED_PAYMENTS: u32 = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DenialCode {
    Unauthorized,
    SessionRevoked,
    SessionExpired,
    Paused,
    ProfileMismatch,
    PolicyChanged,
    DomainMismatch,
    InvalidInvoice,
    InvoiceExpired,
    IdentityChanged,
    BlockedService,
    BlockedPayout,
    PurchaseCap,
    DailyCap,
    RateLimit,
    InsufficientFunds,
    InsufficientBacking,
    StorageCredit,
    Capacity,
    UnknownService,
    PaymentIdConflict,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CredentialFailure {
    Missing,
    UnacceptedIssuer,
    WrongSubject,
    WrongScope,
    WrongSuite,
    Expired,
    Revoked,
    RevisionChanged,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Decision {
    Allow,
    Deny {
        code: DenialCode,
        #[serde(skip_serializing_if = "Option::is_none")]
        retry_after_ns: Option<U64String>,
    },
    RequireValidation {
        code: CredentialFailure,
        requirement: CapabilityRequirement,
    },
}
impl Decision {
    pub fn deny(code: DenialCode) -> Self {
        Self::Deny {
            code,
            retry_after_ns: None,
        }
    }
}

/// Owner-wide counters, never a per-session allowance. Pending principal comes
/// directly from the actor ledger and includes every unresolved dispatch day.
#[derive(Clone, Copy, Debug, Default)]
pub struct UsageSnapshot {
    pub settled_current_day_yocto: u128,
    pub minute_bucket: u64,
    pub dispatched_in_minute: u32,
    pub outstanding_transfers: u32,
    pub retained_payments: u32,
}
/// Pre-operation observations. The evaluator projects the same storage charge
/// into both stake and unused credit. Available claims still include the amount
/// about to be sent; pending transfers are not subtracted again from real B.
#[derive(Clone, Copy, Debug)]
pub struct BackingSnapshot {
    pub runtime_balance_yocto: u128,
    pub storage_stake_yocto: u128,
    pub operating_reserve_yocto: u128,
    pub aggregate_available_yocto: u128,
    pub aggregate_storage_credit_yocto: u128,
    pub storage_charge_yocto: u128,
}
/// Constructed internally from actual state and registered-key verification.
/// Never deserialize this structure from public execute/preview arguments.
pub struct PolicySnapshot<'a> {
    pub now_ns: u64,
    pub network: &'a str,
    pub core_account: &'a AccountId,
    pub owner: &'a ActorState,
    pub service: Option<&'a ServiceIdentity>,
    pub signature_valid: bool,
    pub usage: UsageSnapshot,
    pub backing: BackingSnapshot,
}
#[derive(Clone, Copy, Default)]
pub struct CredentialEvidence<'a> {
    pub reference: Option<&'a CredentialRef>,
    pub record: Option<&'a Credential>,
}

/// Deterministic primary reason. Authentication and immutable duplicate lookup
/// happen before this function. It neither verifies key possession nor dispatches.
pub fn evaluate(
    snapshot: &PolicySnapshot<'_>,
    invoice: &InvoiceV1,
    credential: CredentialEvidence<'_>,
) -> Decision {
    use DenialCode as D;
    let owner = snapshot.owner;
    if owner.owner_id != invoice.owner_id {
        return Decision::deny(D::Unauthorized);
    }
    let Some(session) = owner.sessions.get(&invoice.session_id) else {
        return Decision::deny(D::Unauthorized);
    };
    if session.session_id != invoice.session_id {
        return Decision::deny(D::Unauthorized);
    }
    // Session status, pause, exact profile, policy revision, then domain.
    if session.revoked {
        return Decision::deny(D::SessionRevoked);
    }
    if session.expires_at_ns.0 <= snapshot.now_ns {
        return Decision::deny(D::SessionExpired);
    }
    if owner.policy.paused {
        return Decision::deny(D::Paused);
    }
    let Some(profile) = owner.profiles.get(&session.profile_id) else {
        return Decision::deny(D::ProfileMismatch);
    };
    if session.profile_id != invoice.profile_id
        || session.profile_revision != invoice.profile_revision
        || profile.profile_id != session.profile_id
        || profile.revision != session.profile_revision
    {
        return Decision::deny(D::ProfileMismatch);
    }
    if owner.policy.revision != invoice.policy_revision {
        return Decision::deny(D::PolicyChanged);
    }
    if invoice.network != snapshot.network
        || invoice.network != "near:testnet"
        || invoice.core_account != *snapshot.core_account
    {
        return Decision::deny(D::DomainMismatch);
    }

    // Wire semantics/dates, current registered identity, registered-key signature.
    if invoice.schema_version != 1 || invoice.asset != "NEAR" || invoice.amount_yocto.0 == 0 {
        return Decision::deny(D::InvalidInvoice);
    }
    if invoice.expires_at_ns.0 <= snapshot.now_ns {
        return Decision::deny(D::InvoiceExpired);
    }
    if invoice.issued_at_ns.0 > snapshot.now_ns.saturating_add(5_000_000_000)
        || !invoice
            .expires_at_ns
            .0
            .checked_sub(invoice.issued_at_ns.0)
            .is_some_and(|lifetime| lifetime > 0 && lifetime <= 300_000_000_000)
    {
        return Decision::deny(D::InvalidInvoice);
    }
    let Some(service) = snapshot.service else {
        return Decision::deny(D::IdentityChanged);
    };
    if !service.active
        || service.service_id != invoice.service_id
        || service.version != invoice.service_version
        || service.payout_account != invoice.payout_account
        || service.endpoint_hash != invoice.endpoint_hash
    {
        return Decision::deny(D::IdentityChanged);
    }
    if !snapshot.signature_valid {
        return Decision::deny(D::InvalidInvoice);
    }

    if owner.blocked_services.contains(&invoice.service_id) {
        return Decision::deny(D::BlockedService);
    }
    if owner.blocked_payouts.contains(&invoice.payout_account) {
        return Decision::deny(D::BlockedPayout);
    }

    let amount = invoice.amount_yocto.0;
    if amount > session.purchase_cap_yocto.0 {
        return Decision::deny(D::PurchaseCap);
    }
    let daily_usage = snapshot
        .usage
        .settled_current_day_yocto
        .checked_add(owner.ledger.pending_payment_yocto.0)
        .and_then(|used| used.checked_add(amount));
    if !daily_usage.is_some_and(|used| used <= owner.policy.daily_cap_yocto.0) {
        return Decision::deny(D::DailyCap);
    }
    let current_minute = snapshot.now_ns / MINUTE_NS;
    let count = if snapshot.usage.minute_bucket == current_minute {
        snapshot.usage.dispatched_in_minute
    } else {
        0
    };
    if count >= owner.policy.max_dispatches_per_minute {
        return Decision::Deny {
            code: D::RateLimit,
            retry_after_ns: current_minute
                .checked_add(1)
                .and_then(|next| next.checked_mul(MINUTE_NS))
                .map(U64String),
        };
    }
    if owner.ledger.available_yocto.0 < amount {
        return Decision::deny(D::InsufficientFunds);
    }
    let backing = snapshot.backing;
    if owner.ledger.storage_credit_yocto.0 < backing.storage_charge_yocto
        || backing.aggregate_storage_credit_yocto < backing.storage_charge_yocto
    {
        return Decision::deny(D::StorageCredit);
    }
    // Storage is paid from unused credits. Project the SAME charge into S and L,
    // retaining the full pre-transfer A (including this amount). No pending
    // subtraction: observed runtime balance already reflects prior dispatches.
    let post_credit = backing.aggregate_storage_credit_yocto - backing.storage_charge_yocto;
    let required_backing = backing
        .storage_stake_yocto
        .checked_add(backing.storage_charge_yocto)
        .and_then(|stake| stake.checked_add(backing.operating_reserve_yocto))
        .and_then(|value| value.checked_add(post_credit))
        .and_then(|value| value.checked_add(backing.aggregate_available_yocto));
    if !required_backing.is_some_and(|required| backing.runtime_balance_yocto >= required) {
        return Decision::deny(D::InsufficientBacking);
    }
    if snapshot.usage.outstanding_transfers >= MAX_OUTSTANDING_TRANSFERS
        || snapshot.usage.retained_payments >= MAX_RETAINED_PAYMENTS
    {
        return Decision::deny(D::Capacity);
    }

    if let Some(requirement) = &profile.requirement {
        if let Some(code) = credential_failure(requirement, invoice, credential, snapshot.now_ns) {
            return Decision::RequireValidation {
                code,
                requirement: requirement.clone(),
            };
        }
    }
    let Some(trust) = owner.trusted_services.get(&invoice.service_id) else {
        return Decision::deny(D::UnknownService);
    };
    if !trust.active
        || trust
            .expires_at_ns
            .is_some_and(|expiry| expiry.0 <= snapshot.now_ns)
        || !trust.allowed_profile_ids.contains(&invoice.profile_id)
    {
        return Decision::deny(D::UnknownService);
    }
    if trust.service_id != service.service_id
        || trust.service_version != service.version
        || trust.payout_account != service.payout_account
        || trust.invoice_key != service.invoice_key
        || trust.endpoint_hash != service.endpoint_hash
    {
        return Decision::deny(D::IdentityChanged);
    }
    Decision::Allow
}

fn credential_failure(
    requirement: &CapabilityRequirement,
    invoice: &InvoiceV1,
    evidence: CredentialEvidence<'_>,
    now_ns: u64,
) -> Option<CredentialFailure> {
    use CredentialFailure as C;
    // Invalid required profiles fail closed even if a corrupt snapshot bypasses
    // owner configuration checks. Null is the only way to require no credential.
    if requirement.accepted_issuers.is_empty()
        || requirement.accepted_issuers.len() > MAX_ACCEPTED_ISSUERS
        || requirement
            .accepted_issuers
            .iter()
            .enumerate()
            .any(|(index, issuer)| requirement.accepted_issuers[..index].contains(issuer))
    {
        return Some(C::UnacceptedIssuer);
    }
    if requirement.capability_namespace != "invoice.audit" || requirement.capability_version != 1 {
        return Some(C::WrongScope);
    }
    if requirement.conformance_suite_version == 0 {
        return Some(C::WrongSuite);
    }
    let Some(reference) = evidence.reference else {
        return Some(C::Missing);
    };
    if !requirement.accepted_issuers.contains(&reference.issuer_id) {
        return Some(C::UnacceptedIssuer);
    }
    let Some(record) = evidence.record else {
        return Some(C::Missing);
    };
    if record.issuer_id != reference.issuer_id || record.credential_id != reference.credential_id {
        return Some(C::Missing);
    }
    if record.revision != reference.revision {
        return Some(C::RevisionChanged);
    }
    let assertion = &record.assertion;
    if assertion.service_id != invoice.service_id
        || assertion.service_version != invoice.service_version
    {
        return Some(C::WrongSubject);
    }
    if assertion.capability_namespace != requirement.capability_namespace
        || assertion.capability_version != requirement.capability_version
    {
        return Some(C::WrongScope);
    }
    if assertion.conformance_suite_version != requirement.conformance_suite_version
        || assertion.conformance_suite_hash != requirement.conformance_suite_hash
    {
        return Some(C::WrongSuite);
    }
    if !credential_dates_valid(assertion, now_ns) {
        return Some(C::Expired);
    }
    if record.revoked {
        return Some(C::Revoked);
    }
    None
}
