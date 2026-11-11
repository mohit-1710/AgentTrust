//! Native actor-funded vault with authoritative payment admission and dispatch.
use agenttrust_domain::{
    accounting::PaymentRecord,
    owner::ActorState,
    registry::{Credential, ServiceIdentity},
    types::{Hash32, U128String},
};
use near_sdk::{
    AccountId, PanicOnDefault, env, near,
    store::{LookupMap, Vector},
};

pub mod authority;
mod callbacks;
mod events;
mod owner;
mod payments;
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
    payments: LookupMap<(AccountId, Hash32), PaymentRecord>,
    payment_ids: LookupMap<AccountId, Vec<Hash32>>,
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
            payments: LookupMap::new(b"payments:v1".to_vec()),
            payment_ids: LookupMap::new(b"payment-ids:v1".to_vec()),
        }
    }
}
