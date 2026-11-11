//! Pure caller/authority checks; runtime values are supplied by the contract.
use crate::{
    owner::{ActorState, Profile, Session},
    types::{AccountId, ProfileId},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthorityError {
    Unauthorized,
    UnfundedAccount,
    RevisionMismatch,
    RevisionOverflow,
    InvalidProfile,
    Capacity,
    ProfileMismatch,
    SessionExists,
    SessionMissing,
    DuplicateActiveKey,
    SessionExpired,
    SessionRevoked,
    StorageCredit,
    ArithmeticOverflow,
    InvalidDeposit,
    InvalidTrust,
    IdentityChanged,
}
impl AuthorityError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Unauthorized => "UNAUTHORIZED",
            Self::UnfundedAccount => "UNFUNDED_ACCOUNT",
            Self::RevisionMismatch => "POLICY_CHANGED",
            Self::RevisionOverflow => "REVISION_OVERFLOW",
            Self::InvalidProfile => "INVALID_PROFILE",
            Self::Capacity => "CAPACITY",
            Self::ProfileMismatch => "PROFILE_MISMATCH",
            Self::SessionExists => "SESSION_EXISTS",
            Self::SessionMissing => "SESSION_MISSING",
            Self::DuplicateActiveKey => "DUPLICATE_ACTIVE_KEY",
            Self::SessionExpired => "SESSION_EXPIRED",
            Self::SessionRevoked => "SESSION_REVOKED",
            Self::StorageCredit => "STORAGE_CREDIT",
            Self::ArithmeticOverflow => "ARITHMETIC_OVERFLOW",
            Self::InvalidDeposit => "INVALID_DEPOSIT",
            Self::InvalidTrust => "INVALID_TRUST",
            Self::IdentityChanged => "IDENTITY_CHANGED",
        }
    }
}
impl std::fmt::Display for AuthorityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.code())
    }
}
impl std::error::Error for AuthorityError {}

pub struct CallContext<'a> {
    pub current_account: &'a AccountId,
    pub predecessor: &'a AccountId,
    pub signer: &'a AccountId,
    /// Complete canonical native key, including its curve prefix.
    pub signer_public_key: &'a str,
    pub attached_deposit_yocto: u128,
}

pub fn authorize_initialization(context: &CallContext<'_>) -> Result<(), AuthorityError> {
    if context.predecessor != context.current_account
        || context.signer != context.current_account
        || context.attached_deposit_yocto != 0
    {
        return Err(AuthorityError::Unauthorized);
    }
    Ok(())
}

pub fn management_actor(context: &CallContext<'_>) -> Result<AccountId, AuthorityError> {
    if context.predecessor != context.signer || context.attached_deposit_yocto != 1 {
        return Err(AuthorityError::Unauthorized);
    }
    Ok(context.signer.clone())
}

pub fn require_actor(actor: Option<&ActorState>) -> Result<&ActorState, AuthorityError> {
    actor.ok_or(AuthorityError::UnfundedAccount)
}

/// Authentication precedes the exact-payment lookup. Revocation/expiry checks
/// apply only to new dispatch, so an exact retry can observe its prior payment.
pub fn authenticate_worker(
    context: &CallContext<'_>,
    owner_id: &AccountId,
    session: &Session,
) -> Result<(), AuthorityError> {
    if context.predecessor != context.signer
        || context.signer != owner_id
        || context.attached_deposit_yocto != 0
        || context.signer_public_key != session.public_key
    {
        return Err(AuthorityError::Unauthorized);
    }
    Ok(())
}

pub fn authorize_session(
    session: &Session,
    profile: &Profile,
    claimed_profile_id: &ProfileId,
    claimed_profile_revision: u32,
    now_ns: u64,
) -> Result<(), AuthorityError> {
    if session.revoked {
        return Err(AuthorityError::SessionRevoked);
    }
    if session.expires_at_ns.0 <= now_ns {
        return Err(AuthorityError::SessionExpired);
    }
    if session.profile_id != *claimed_profile_id
        || session.profile_revision != claimed_profile_revision
        || profile.profile_id != session.profile_id
        || profile.revision != session.profile_revision
    {
        return Err(AuthorityError::ProfileMismatch);
    }
    Ok(())
}

/// Direct funding authority is separate from one-yocto management authority.
pub fn funding_actor(context: &CallContext<'_>) -> Result<AccountId, AuthorityError> {
    if context.predecessor != context.signer {
        return Err(AuthorityError::Unauthorized);
    }
    if context.attached_deposit_yocto == 0 {
        return Err(AuthorityError::InvalidDeposit);
    }
    Ok(context.signer.clone())
}

/// Callback authority comes from the actual predecessor and promise-result count,
/// never the transaction signer or a caller-supplied outcome.
pub fn authorize_callback(
    current_account: &AccountId,
    predecessor: &AccountId,
    promise_results_count: u64,
) -> Result<(), AuthorityError> {
    if predecessor != current_account || promise_results_count != 1 {
        return Err(AuthorityError::Unauthorized);
    }
    Ok(())
}
