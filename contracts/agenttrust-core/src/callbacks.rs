use crate::{AgentTrustCore, AgentTrustCoreExt, authority::require_callback, events};
use agenttrust_domain::{
    accounting::{TransferOutcome, finalize_payment},
    payments::PaymentView,
    types::Hash32,
};
use near_sdk::{AccountId, PromiseError, env, near};

/// A separate, default-off build demonstrates payout success plus callback failure.
/// There is no public fault switch, resolver or invented refund transition.
fn inject_runtime_test_fault() {
    #[cfg(feature = "runtime-test-callback-failure")]
    env::panic_str("RUNTIME_TEST_CALLBACK_FAILURE");
}

pub(crate) fn definitive_transfer_outcome() -> TransferOutcome {
    // Called only after require_callback checked the actual count is exactly one.
    // A native Transfer action returns no payload. Bound the read and never
    // turn an unexpected result shape into a refund decision.
    match env::promise_result_checked(0, 0) {
        Ok(_) => TransferOutcome::Succeeded,
        Err(PromiseError::Failed) => TransferOutcome::Failed,
        Err(_) => env::panic_str("UNEXPECTED_TRANSFER_RESULT"),
    }
}

#[near]
impl AgentTrustCore {
    #[private]
    pub fn on_payment_result(&mut self, owner_id: AccountId, payment_id: Hash32) -> PaymentView {
        require_callback();
        let key = (owner_id.clone(), payment_id);
        let payment = self
            .payments
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("PAYMENT_NOT_FOUND"));
        let actor = self
            .actors
            .get(&owner_id)
            .unwrap_or_else(|| env::panic_str("INCONSISTENT_PAYMENT_STATE"));
        inject_runtime_test_fault();
        let now_ns = env::block_timestamp();
        let finalized = finalize_payment(
            actor,
            self.aggregate_liabilities(),
            &payment,
            definitive_transfer_outcome(),
            now_ns,
        )
        .unwrap_or_else(|_| env::panic_str("INCONSISTENT_PAYMENT_STATE"));
        if finalized.duplicate {
            return PaymentView::new(finalized.payment, now_ns);
        }
        // Dispatch prepaid every byte. Terminal enum/timestamp and all counters
        // have fixed widths; no current policy/identity check or index allocation.
        let storage_before = env::storage_usage();
        self.total_available_yocto = finalized.liabilities.available_yocto;
        self.payments.insert(key, finalized.payment.clone());
        self.actors.insert(owner_id, finalized.actor);
        self.payments.flush();
        self.actors.flush();
        env::state_write(self);
        if env::storage_usage() > storage_before {
            env::panic_str("UNPRICED_CALLBACK_STORAGE_GROWTH");
        }
        events::payment_finalized(&finalized.payment, self.backing_observation());
        PaymentView::new(finalized.payment, now_ns)
    }
}

impl AgentTrustCore {
    pub(crate) fn backing_observation(&self) -> events::BackingObservation {
        use agenttrust_domain::types::{U64String, U128String};
        events::BackingObservation {
            runtime_account_balance_yocto: U128String(env::account_balance().as_yoctonear()),
            total_available_yocto: U128String(self.total_available_yocto),
            total_storage_credit_yocto: U128String(self.total_storage_credit_yocto),
            operating_reserve_yocto: U128String(self.operating_reserve_yocto),
            storage_usage_bytes: U64String(env::storage_usage()),
            storage_byte_cost_yocto: U128String(env::storage_byte_cost().as_yoctonear()),
        }
    }
}
