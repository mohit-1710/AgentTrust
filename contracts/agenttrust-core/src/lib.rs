//! T02 build probe only. Owner, policy and payment behavior arrive in later tasks.
use near_sdk::{AccountId, env, near};

#[near(contract_state)]
pub struct AgentTrustCore {}

#[near]
impl AgentTrustCore {
    /// Read-only build probe that requires the actual NEAR host import.
    pub fn current_account() -> AccountId {
        env::current_account_id()
    }
}
