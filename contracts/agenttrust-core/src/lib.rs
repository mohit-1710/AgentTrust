//! Native owner/session authority and actor-funded ledger. Payments follow in later tasks.
use agenttrust_domain::{
    owner::ActorState,
    registry::{Credential, ServiceIdentity},
    types::{Hash32, U128String},
};
use near_sdk::{
    AccountId, PanicOnDefault, env, near,
    store::{LookupMap, Vector},
};

pub mod authority;
mod owner;
mod registry;
mod views;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentTrustCore {
    network: String,
    operating_reserve_yocto: u128,
    total_available_yocto: u128,
    total_storage_credit_yocto: u128,
    actors: LookupMap<AccountId, ActorState>,
    services: LookupMap<AccountId, ServiceIdentity>,
    service_ids: Vector<AccountId>,
    credentials: LookupMap<(AccountId, Hash32), Credential>,
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
            services: LookupMap::new(b"services:v1".to_vec()),
            service_ids: Vector::new(b"service-ids:v1".to_vec()),
            credentials: LookupMap::new(b"credentials:v1".to_vec()),
        }
    }
}
