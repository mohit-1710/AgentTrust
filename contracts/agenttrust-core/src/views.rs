use crate::{AgentTrustCore, AgentTrustCoreExt};
use agenttrust_domain::{
    owner::{OwnerPolicy, Profile, Session},
    types::{Hash32, U128String},
};
use near_sdk::{AccountId, env, near, serde::Serialize};

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct CoreConfig {
    pub network: String,
    pub core_account: AccountId,
    pub operating_reserve_yocto: U128String,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OwnerPolicyView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub policy: OwnerPolicy,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProfileView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub profile: Profile,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SessionView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub session: Session,
}

#[near]
impl AgentTrustCore {
    pub fn get_config(&self) -> CoreConfig {
        CoreConfig {
            network: self.network.clone(),
            core_account: env::current_account_id(),
            operating_reserve_yocto: U128String(self.operating_reserve_yocto),
        }
    }
    pub fn get_policy(&self, owner_id: AccountId) -> Option<OwnerPolicyView> {
        self.actors.get(&owner_id).map(|actor| OwnerPolicyView {
            owner_id,
            policy: actor.policy.clone(),
        })
    }
    pub fn get_session(&self, owner_id: AccountId, session_id: Hash32) -> Option<SessionView> {
        self.actors
            .get(&owner_id)?
            .sessions
            .get(&session_id)
            .map(|session| SessionView {
                owner_id,
                session: session.clone(),
            })
    }
}
