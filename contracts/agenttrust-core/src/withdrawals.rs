use crate::{
    AgentTrustCore, AgentTrustCoreExt, authority::require_callback,
    callbacks::definitive_transfer_outcome, events,
};
use agenttrust_domain::{
    payments::required_before_transfer,
    policy::BackingSnapshot,
    types::{Hash32, U64String, U128String},
    withdrawals::{
        WithdrawalError, WithdrawalView, finalize_withdrawal, precheck_withdrawal_backing,
        reserve_withdrawal, withdrawal_storage_bound,
    },
};
use near_sdk::{AccountId, Gas, NearToken, Promise, env, near, serde::Serialize};

/// Static bounded allowance; actual callback consumption remains a T13 runtime check.
const WITHDRAWAL_CALLBACK_GAS: Gas = Gas::from_tgas(30);

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct WithdrawalCallbackArgs {
    owner_id: AccountId,
    withdrawal_id: Hash32,
}

fn must_withdraw<T>(result: Result<T, WithdrawalError>) -> T {
    result.unwrap_or_else(|error| env::panic_str(error.code()))
}

#[near]
impl AgentTrustCore {
    #[payable]
    pub fn withdraw_available(
        &mut self,
        withdrawal_id: Hash32,
        amount_yocto: U128String,
    ) -> WithdrawalView {
        // Actual direct owner and exact one-yocto authority, never a caller label.
        let (owner_id, actor) = self.managed_actor();
        let key = (owner_id.clone(), withdrawal_id);
        let now_ns = env::block_timestamp();
        let reserved = must_withdraw(reserve_withdrawal(
            &actor,
            self.aggregate_liabilities(),
            withdrawal_id,
            amount_yocto,
            self.withdrawals.get(&key),
            now_ns,
        ));
        if reserved.duplicate {
            return WithdrawalView::new(reserved.withdrawal, now_ns);
        }
        let storage_before = env::storage_usage();
        let byte_cost = env::storage_byte_cost().as_yoctonear();
        let storage_bound = withdrawal_storage_bound(&reserved.withdrawal);
        must_withdraw(precheck_withdrawal_backing(
            &actor,
            BackingSnapshot {
                runtime_balance_yocto: env::account_balance().as_yoctonear(),
                storage_stake_yocto: u128::from(storage_before)
                    .checked_mul(byte_cost)
                    .unwrap_or_else(|| env::panic_str("ARITHMETIC_OVERFLOW")),
                operating_reserve_yocto: self.operating_reserve_yocto,
                aggregate_available_yocto: self.total_available_yocto,
                aggregate_storage_credit_yocto: self.total_storage_credit_yocto,
                storage_charge_yocto: u128::from(storage_bound)
                    .checked_mul(byte_cost)
                    .unwrap_or_else(|| env::panic_str("ARITHMETIC_OVERFLOW")),
            },
        ));

        // Persist reservation and price all growth before scheduling. Every later
        // failure panics so the receipt rolls back all provisional writes/actions.
        self.total_available_yocto = reserved.liabilities.available_yocto;
        if self
            .withdrawals
            .insert(key, reserved.withdrawal.clone())
            .is_some()
        {
            env::panic_str("INCONSISTENT_WITHDRAWAL_STATE");
        }
        self.withdrawals.flush();
        self.save_actor_charging_growth(owner_id.clone(), reserved.actor, storage_before);
        let storage_after = env::storage_usage();
        if storage_after.saturating_sub(storage_before) > storage_bound {
            env::panic_str("WITHDRAWAL_STORAGE_BOUND_EXCEEDED");
        }
        let stake = u128::from(storage_after)
            .checked_mul(byte_cost)
            .unwrap_or_else(|| env::panic_str("ARITHMETIC_OVERFLOW"));
        let required = required_before_transfer(
            stake,
            self.operating_reserve_yocto,
            self.aggregate_liabilities(),
            amount_yocto.0,
        )
        .unwrap_or_else(|| env::panic_str("ARITHMETIC_OVERFLOW"));
        let balance_before = env::account_balance().as_yoctonear();
        if balance_before < required {
            env::panic_str("INSUFFICIENT_BACKING");
        }
        let args = near_sdk::serde_json::to_vec(&WithdrawalCallbackArgs {
            owner_id: owner_id.clone(),
            withdrawal_id,
        })
        .unwrap_or_else(|_| env::panic_str("CALLBACK_ENCODING"));
        Promise::new(owner_id)
            .transfer(NearToken::from_yoctonear(amount_yocto.0))
            .then(Promise::new(env::current_account_id()).function_call(
                "on_withdrawal_result",
                args,
                NearToken::from_yoctonear(0),
                WITHDRAWAL_CALLBACK_GAS,
            ))
            .detach();
        events::withdrawal_dispatched(
            &reserved.withdrawal,
            events::DispatchBacking {
                runtime_balance_before_schedule_yocto: U128String(balance_before),
                runtime_balance_after_schedule_yocto: U128String(
                    env::account_balance().as_yoctonear(),
                ),
                required_before_transfer_yocto: U128String(required),
                total_available_after_reservation_yocto: U128String(self.total_available_yocto),
                total_storage_credit_after_charge_yocto: U128String(
                    self.total_storage_credit_yocto,
                ),
                operating_reserve_yocto: U128String(self.operating_reserve_yocto),
                storage_usage_after_charge_bytes: U64String(storage_after),
                storage_byte_cost_yocto: U128String(byte_cost),
            },
        );
        WithdrawalView::new(reserved.withdrawal, now_ns)
    }

    #[private]
    pub fn on_withdrawal_result(
        &mut self,
        owner_id: AccountId,
        withdrawal_id: Hash32,
    ) -> WithdrawalView {
        require_callback();
        let key = (owner_id.clone(), withdrawal_id);
        let withdrawal = self
            .withdrawals
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("WITHDRAWAL_NOT_FOUND"));
        let actor = self
            .actors
            .get(&owner_id)
            .unwrap_or_else(|| env::panic_str("INCONSISTENT_WITHDRAWAL_STATE"));
        let now_ns = env::block_timestamp();
        let finalized = must_withdraw(finalize_withdrawal(
            actor,
            self.aggregate_liabilities(),
            &withdrawal,
            definitive_transfer_outcome(),
            now_ns,
        ));
        if finalized.duplicate {
            return WithdrawalView::new(finalized.withdrawal, now_ns);
        }
        let storage_before = env::storage_usage();
        self.total_available_yocto = finalized.liabilities.available_yocto;
        self.withdrawals.insert(key, finalized.withdrawal.clone());
        self.actors.insert(owner_id, finalized.actor);
        self.withdrawals.flush();
        self.actors.flush();
        env::state_write(self);
        if env::storage_usage() > storage_before {
            env::panic_str("UNPRICED_CALLBACK_STORAGE_GROWTH");
        }
        events::withdrawal_finalized(&finalized.withdrawal, self.backing_observation());
        WithdrawalView::new(finalized.withdrawal, now_ns)
    }

    pub fn get_withdrawal(
        &self,
        owner_id: AccountId,
        withdrawal_id: Hash32,
    ) -> Option<WithdrawalView> {
        self.withdrawals
            .get(&(owner_id, withdrawal_id))
            .cloned()
            .map(|record| WithdrawalView::new(record, env::block_timestamp()))
    }
}
