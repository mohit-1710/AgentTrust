use crate::{AgentTrustCore, AgentTrustCoreExt};
use agenttrust_domain::{
    owner::{AccountLedger, ActorState, OwnerPolicy, Profile, Session, TrustEntry},
    payments::PaymentView,
    policy::DAY_NS,
    types::{Hash32, U64String, U128String},
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

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TrustEntryView {
    pub owner_id: AccountId,
    #[serde(flatten)]
    pub trust: TrustEntry,
}

/// Observed backing inputs only, not a payment authorization or runtime proof.
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultSnapshot {
    pub total_available_yocto: U128String,
    pub total_storage_credit_yocto: U128String,
    pub operating_reserve_yocto: U128String,
    pub runtime_account_balance_yocto: U128String,
    pub storage_usage_bytes: U64String,
    pub storage_byte_cost_yocto: U128String,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AccountLedgerView {
    pub account_id: AccountId,
    #[serde(flatten)]
    pub ledger: AccountLedger,
    pub vault: VaultSnapshot,
    pub usage: AccountUsageView,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AccountUsageView {
    pub current_day: U64String,
    pub settled_current_day_yocto: U128String,
    pub dispatch_minute: U64String,
    pub dispatched_in_minute: u32,
    pub outstanding_transfers: u32,
    pub retained_payments: u32,
}

impl AgentTrustCore {
    pub(crate) fn account_ledger_view(&self, actor: &ActorState) -> AccountLedgerView {
        let now_ns = env::block_timestamp();
        let usage = actor.usage.snapshot(now_ns);
        AccountLedgerView {
            account_id: actor.owner_id.clone(),
            ledger: actor.ledger.clone(),
            usage: AccountUsageView {
                current_day: U64String(now_ns / DAY_NS),
                settled_current_day_yocto: U128String(usage.settled_current_day_yocto),
                dispatch_minute: U64String(usage.minute_bucket),
                dispatched_in_minute: usage.dispatched_in_minute,
                outstanding_transfers: usage.outstanding_transfers,
                retained_payments: usage.retained_payments,
            },
            vault: VaultSnapshot {
                total_available_yocto: U128String(self.total_available_yocto),
                total_storage_credit_yocto: U128String(self.total_storage_credit_yocto),
                operating_reserve_yocto: U128String(self.operating_reserve_yocto),
                runtime_account_balance_yocto: U128String(env::account_balance().as_yoctonear()),
                storage_usage_bytes: U64String(env::storage_usage()),
                storage_byte_cost_yocto: U128String(env::storage_byte_cost().as_yoctonear()),
            },
        }
    }
}

#[near]
impl AgentTrustCore {
    pub fn get_account(&self, account_id: AccountId) -> Option<AccountLedgerView> {
        self.actors
            .get(&account_id)
            .map(|actor| self.account_ledger_view(actor))
    }

    pub fn get_payment(&self, owner_id: AccountId, payment_id: Hash32) -> Option<PaymentView> {
        self.payments
            .get(&(owner_id, payment_id))
            .map(|record| PaymentView::new(record.clone(), env::block_timestamp()))
    }

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
