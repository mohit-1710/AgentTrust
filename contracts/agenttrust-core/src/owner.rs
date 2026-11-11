use crate::{
    AgentTrustCore, AgentTrustCoreExt,
    authority::{must, require_funding, require_management},
    views::{AccountLedgerView, OwnerPolicyView, ProfileView, SessionView},
};
use agenttrust_domain::{
    accounting::{AggregateLiabilities, charge_actor_storage, credit_deposit},
    authority::require_actor,
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

    pub(crate) fn aggregate_liabilities(&self) -> AggregateLiabilities {
        AggregateLiabilities {
            available_yocto: self.total_available_yocto,
            storage_credit_yocto: self.total_storage_credit_yocto,
        }
    }

    /// Measure all provisional writes, including root serialization, before pricing
    /// growth. Failure must panic: an ordinary error return would preserve those
    /// provisional writes. T13 must verify actual rollback and host accounting.
    pub(crate) fn save_actor_charging_growth(
        &mut self,
        owner_id: AccountId,
        actor: ActorState,
        storage_before: u64,
    ) -> ActorState {
        self.actors.insert(owner_id.clone(), actor.clone());
        self.actors.flush();
        env::state_write(self);
        let measured_storage = env::storage_usage();
        let growth_bytes = measured_storage.saturating_sub(storage_before);
        let charged = must(charge_actor_storage(
            &actor,
            self.aggregate_liabilities(),
            growth_bytes,
            env::storage_byte_cost().as_yoctonear(),
        ));
        self.total_storage_credit_yocto = charged.liabilities.storage_credit_yocto;
        self.actors.insert(owner_id, charged.actor.clone());
        self.actors.flush();
        env::state_write(self);
        // The root has immutable strings/prefix and fixed-width integers. Actor
        // credit counters also have fixed Borsh widths; this rewrite cannot grow.
        // Fail closed if later layout changes invalidate that assumption. Shrinkage
        // never becomes a refundable credit or available principal in this version.
        if env::storage_usage() > measured_storage {
            env::panic_str("UNPRICED_STORAGE_GROWTH");
        }
        charged.actor
    }
}

#[near]
impl AgentTrustCore {
    /// Sole actor-creation path: every deposited yocto is assigned before storage
    /// pricing. Owner management's one-yocto deposits remain operating funds.
    #[payable]
    pub fn deposit(&mut self, storage_credit_yocto: U128String) -> AccountLedgerView {
        let owner_id = require_funding();
        let actor = self
            .actors
            .get(&owner_id)
            .cloned()
            .unwrap_or_else(|| ActorState::new(owner_id.clone()));
        let credited = must(credit_deposit(
            &actor,
            self.aggregate_liabilities(),
            env::attached_deposit().as_yoctonear(),
            storage_credit_yocto.0,
        ));
        let storage_before = env::storage_usage();
        self.total_available_yocto = credited.liabilities.available_yocto;
        self.total_storage_credit_yocto = credited.liabilities.storage_credit_yocto;
        let actor = self.save_actor_charging_growth(owner_id, credited.actor, storage_before);
        self.account_ledger_view(&actor)
    }

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
