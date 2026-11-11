use crate::{
    AgentTrustCore, AgentTrustCoreExt,
    authority::{must, require_management},
    views::{OwnerPolicyView, ProfileView, SessionView},
};
use agenttrust_domain::{
    authority::{AuthorityError, require_actor},
    owner::{ActorState, CapabilityRequirement, SessionRegistration},
    types::{Hash32, ProfileId, U64String, U128String},
};
use near_sdk::{AccountId, PublicKey, env, near};

impl AgentTrustCore {
    fn managed_actor(&self) -> (AccountId, ActorState) {
        let owner_id = require_management();
        let actor = must(require_actor(self.actors.get(&owner_id))).clone();
        (owner_id, actor)
    }

    /// Persist the bounded actor change before pricing actual host storage growth.
    /// The root's fields are fixed-size or immutable after initialization; updating
    /// its aggregate integers cannot grow its eventual serialization. T13 must
    /// establish the complete runtime/storage behavior before any safety claim.
    pub(crate) fn save_actor_charging_growth(
        &mut self,
        owner_id: AccountId,
        mut actor: ActorState,
        storage_before: u64,
    ) {
        self.actors.insert(owner_id.clone(), actor.clone());
        self.actors.flush();
        let growth_bytes = env::storage_usage().saturating_sub(storage_before);
        let charge = must(
            actor.charge_storage_growth(growth_bytes, env::storage_byte_cost().as_yoctonear()),
        );
        self.total_storage_credit_yocto = must(
            self.total_storage_credit_yocto
                .checked_sub(charge)
                .ok_or(AuthorityError::StorageCredit),
        );
        // Credit and charged-byte fields have fixed Borsh widths. Rewriting them
        // adds no bytes beyond those just measured. No storage shrinkage refund.
        self.actors.insert(owner_id, actor);
        self.actors.flush();
    }
}

#[near]
impl AgentTrustCore {
    #[payable]
    pub fn set_policy(
        &mut self,
        expected_revision: u32,
        daily_cap_yocto: U128String,
        max_dispatches_per_minute: u32,
        paused: bool,
    ) -> OwnerPolicyView {
        let (owner_id, mut actor) = self.managed_actor();
        let storage_before = env::storage_usage();
        let policy = must(actor.set_policy(
            expected_revision,
            daily_cap_yocto,
            max_dispatches_per_minute,
            paused,
        ));
        self.save_actor_charging_growth(owner_id.clone(), actor, storage_before);
        OwnerPolicyView { owner_id, policy }
    }
    #[payable]
    pub fn set_profile(
        &mut self,
        profile_id: ProfileId,
        expected_revision: Option<u32>,
        requirement: Option<CapabilityRequirement>,
    ) -> ProfileView {
        let (owner_id, mut actor) = self.managed_actor();
        let storage_before = env::storage_usage();
        let profile = must(actor.set_profile(profile_id, expected_revision, requirement));
        self.save_actor_charging_growth(owner_id.clone(), actor, storage_before);
        ProfileView { owner_id, profile }
    }
    #[payable]
    pub fn register_session(
        &mut self,
        session_id: Hash32,
        public_key: PublicKey,
        profile_id: ProfileId,
        profile_revision: u32,
        purchase_cap_yocto: U128String,
        expires_at_ns: U64String,
    ) -> SessionView {
        let (owner_id, mut actor) = self.managed_actor();
        let storage_before = env::storage_usage();
        let session = must(actor.register_session(
            SessionRegistration {
                session_id,
                public_key: public_key.to_string(),
                profile_id,
                profile_revision,
                purchase_cap_yocto,
                expires_at_ns,
            },
            env::block_timestamp(),
        ));
        self.save_actor_charging_growth(owner_id.clone(), actor, storage_before);
        SessionView { owner_id, session }
    }
    #[payable]
    pub fn revoke_session(&mut self, session_id: Hash32) -> SessionView {
        let (owner_id, mut actor) = self.managed_actor();
        let storage_before = env::storage_usage();
        let session = must(actor.revoke_session(&session_id));
        self.save_actor_charging_growth(owner_id.clone(), actor, storage_before);
        SessionView { owner_id, session }
    }
}
