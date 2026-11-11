//! Only this boundary constructs authority context from native host values.
use agenttrust_domain::authority::{self as domain, AuthorityError, CallContext};
use near_sdk::{AccountId, env};

pub(crate) struct RuntimeContext {
    current_account: AccountId,
    predecessor: AccountId,
    signer: AccountId,
    signer_public_key: String,
    attached_deposit_yocto: u128,
}
impl RuntimeContext {
    pub(crate) fn capture() -> Self {
        Self {
            current_account: env::current_account_id(),
            predecessor: env::predecessor_account_id(),
            signer: env::signer_account_id(),
            signer_public_key: env::signer_account_pk().to_string(),
            attached_deposit_yocto: env::attached_deposit().as_yoctonear(),
        }
    }
    pub(crate) fn as_context(&self) -> CallContext<'_> {
        CallContext {
            current_account: &self.current_account,
            predecessor: &self.predecessor,
            signer: &self.signer,
            signer_public_key: &self.signer_public_key,
            attached_deposit_yocto: self.attached_deposit_yocto,
        }
    }
}

pub fn must<T>(result: Result<T, AuthorityError>) -> T {
    result.unwrap_or_else(|error| env::panic_str(error.code()))
}

pub fn require_initialization() {
    let context = RuntimeContext::capture();
    must(domain::authorize_initialization(&context.as_context()));
}

pub fn require_funding() -> AccountId {
    let context = RuntimeContext::capture();
    must(domain::funding_actor(&context.as_context()))
}

pub fn require_management() -> AccountId {
    let context = RuntimeContext::capture();
    must(domain::management_actor(&context.as_context()))
}
