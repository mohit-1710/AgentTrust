//! Native owner/session boundary. Funding and payments are implemented in later tasks.
use agenttrust_domain::{owner::ActorState, types::U128String};
use near_sdk::{AccountId, PanicOnDefault, env, near, store::LookupMap};

pub mod authority;
mod owner;
mod views;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentTrustCore {
    network: String,
    operating_reserve_yocto: u128,
    total_available_yocto: u128,
    total_storage_credit_yocto: u128,
    actors: LookupMap<AccountId, ActorState>,
}

#[near]
impl AgentTrustCore {
    /// Must be initialized by the contract account, in its deployment transaction.
    #[init]
    pub fn new(network: String, operating_reserve_yocto: U128String) -> Self {
        authority::require_initialization();
        if network != "near:testnet" {
            env::panic_str("DOMAIN_MISMATCH");
        }
        Self {
            network,
            operating_reserve_yocto: operating_reserve_yocto.0,
            total_available_yocto: 0,
            total_storage_credit_yocto: 0,
            actors: LookupMap::new(b"actors:v1".to_vec()),
        }
    }
}
