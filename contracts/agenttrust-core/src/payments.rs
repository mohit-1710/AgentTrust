use crate::{AgentTrustCore, AgentTrustCoreExt, authority::RuntimeContext, events};
use agenttrust_domain::{
    accounting::PaymentError,
    payments::{
        AdmissionSnapshot, PaymentAdmission, PaymentView, admit_payment, payment_storage_bound,
        required_before_transfer,
    },
    policy::{BackingSnapshot, CredentialEvidence, Decision, MAX_RETAINED_PAYMENTS},
    registry::CredentialRef,
    types::{Hash32, SignedInvoiceV1, U64String, U128String},
};
use near_sdk::{AccountId, Gas, NearToken, Promise, env, near, serde::Serialize};

/// Bounded allowance; T13 must measure actual callback execution. T11 provides
/// the private callback implementation before any runtime use of this contract.
pub(crate) const PAYMENT_CALLBACK_GAS: Gas = Gas::from_tgas(30);

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde", tag = "kind", rename_all = "snake_case")]
pub enum ExecutionResult {
    Rejected {
        decision: Decision,
    },
    Payment {
        payment: PaymentView,
        duplicate: bool,
    },
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentCallbackArgs {
    owner_id: AccountId,
    payment_id: Hash32,
}

fn must_admit<T>(result: Result<T, PaymentError>) -> T {
    result.unwrap_or_else(|error| match error {
        PaymentError::ArithmeticOverflow => env::panic_str("ARITHMETIC_OVERFLOW"),
        // All normal business denials are returned before this boundary. A
        // contradiction in stored accounting must abort the whole receipt.
        _ => env::panic_str("INCONSISTENT_PAYMENT_STATE"),
    })
}

#[near]
impl AgentTrustCore {
    pub fn execute_payment(
        &mut self,
        quote: SignedInvoiceV1,
        credential: Option<CredentialRef>,
    ) -> ExecutionResult {
        let runtime = RuntimeContext::capture();
        let call = runtime.as_context();
        let invoice = &quote.invoice;
        let owner_id = invoice.owner_id.clone();
        let payment_key = (owner_id.clone(), invoice.payment_id);
        let now_ns = env::block_timestamp();
        let storage_before = env::storage_usage();
        let byte_cost = env::storage_byte_cost().as_yoctonear();
        let storage_bound = payment_storage_bound(&quote, credential.as_ref());
        let snapshot = AdmissionSnapshot {
            call: &call,
            now_ns,
            network: &self.network,
            owner: self.actors.get(&owner_id),
            service: self.services.get(&invoice.service_id),
            backing: BackingSnapshot {
                runtime_balance_yocto: env::account_balance().as_yoctonear(),
                storage_stake_yocto: u128::from(storage_before).saturating_mul(byte_cost),
                operating_reserve_yocto: self.operating_reserve_yocto,
                aggregate_available_yocto: self.total_available_yocto,
                aggregate_storage_credit_yocto: self.total_storage_credit_yocto,
                storage_charge_yocto: u128::from(storage_bound).saturating_mul(byte_cost),
            },
        };
        let evidence = CredentialEvidence {
            reference: credential.as_ref(),
            record: credential.as_ref().and_then(|reference| {
                self.credentials
                    .get(&(reference.issuer_id.clone(), reference.credential_id))
            }),
        };
        // This tested helper authenticates actual host context before immutable
        // lookup, then selects the actual registry key and shared evaluator.
        let admission = must_admit(admit_payment(
            &snapshot,
            &quote,
            evidence,
            self.payments.get(&payment_key),
            |signature, bytes, key| env::ed25519_verify(signature, bytes, key),
        ));
        let reserved = match admission {
            PaymentAdmission::Rejected(decision) => {
                // No state writes occurred. This event persists only when this
                // receipt returns successfully; parsing/SDK panics emit no claim.
                events::rejected(invoice, &decision);
                return ExecutionResult::Rejected { decision };
            }
            PaymentAdmission::Duplicate(record) => {
                return ExecutionResult::Payment {
                    payment: PaymentView::new(record, now_ns),
                    duplicate: true,
                };
            }
            PaymentAdmission::Reserved(state) => state,
        };
        let mut ids = self.payment_ids.get(&owner_id).cloned().unwrap_or_default();
        if reserved.duplicate
            || ids.len() >= MAX_RETAINED_PAYMENTS as usize
            || ids.len() + 1 != reserved.actor.usage.retained_payments as usize
        {
            env::panic_str("INCONSISTENT_PAYMENT_INDEX");
        }
        ids.push(invoice.payment_id);

        // Reserve -> persist every changed map/index -> price actual storage ->
        // guard actual backing -> schedule. Every failure below must panic and
        // roll back, never return a benign denial leaving provisional records.
        self.total_available_yocto = reserved.liabilities.available_yocto;
        if self
            .payments
            .insert(payment_key, reserved.payment.clone())
            .is_some()
        {
            env::panic_str("INCONSISTENT_PAYMENT_INDEX");
        }
        self.payment_ids.insert(owner_id.clone(), ids);
        self.payments.flush();
        self.payment_ids.flush();
        self.save_actor_charging_growth(owner_id.clone(), reserved.actor, storage_before);
        let storage_after = env::storage_usage();
        if storage_after.saturating_sub(storage_before) > storage_bound {
            env::panic_str("PAYMENT_STORAGE_BOUND_EXCEEDED");
        }
        let storage_stake = u128::from(storage_after)
            .checked_mul(byte_cost)
            .unwrap_or_else(|| env::panic_str("ARITHMETIC_OVERFLOW"));
        let required = required_before_transfer(
            storage_stake,
            self.operating_reserve_yocto,
            self.aggregate_liabilities(),
            invoice.amount_yocto.0,
        )
        .unwrap_or_else(|| env::panic_str("ARITHMETIC_OVERFLOW"));
        let balance_before = env::account_balance().as_yoctonear();
        if balance_before < required {
            env::panic_str("INSUFFICIENT_BACKING");
        }

        let callback_args = near_sdk::serde_json::to_vec(&PaymentCallbackArgs {
            owner_id,
            payment_id: invoice.payment_id,
        })
        .unwrap_or_else(|_| env::panic_str("CALLBACK_ENCODING"));
        Promise::new(invoice.payout_account.clone())
            .transfer(NearToken::from_yoctonear(invoice.amount_yocto.0))
            .then(Promise::new(env::current_account_id()).function_call(
                "on_payment_result",
                callback_args,
                NearToken::from_yoctonear(0),
                PAYMENT_CALLBACK_GAS,
            ))
            .detach(); // Forces lazy construction now; never returns it as settlement.
        events::dispatched(
            &reserved.payment,
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
        ExecutionResult::Payment {
            payment: PaymentView::new(reserved.payment, now_ns),
            duplicate: false,
        }
    }
}
