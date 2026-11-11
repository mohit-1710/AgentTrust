//! Bounded public NEP-297 observations; no request body, CSV or signing key.
use agenttrust_domain::{
    accounting::{PaymentRecord, PaymentState},
    codec::invoice_hash,
    policy::Decision,
    types::{AccountId, FixedBytes, Hash32, InvoiceV1, U64String, U128String},
    withdrawals::WithdrawalRecord,
};
use near_sdk::{env, serde::Serialize};

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct Event<'a, T: Serialize> {
    standard: &'static str,
    version: &'static str,
    event: &'a str,
    data: [T; 1],
}
pub(crate) fn emit<T: Serialize>(name: &str, data: T) {
    let event = Event {
        standard: "agenttrust",
        version: "1.0.0",
        event: name,
        data: [data],
    };
    let json = near_sdk::serde_json::to_string(&event)
        .unwrap_or_else(|_| env::panic_str("EVENT_ENCODING"));
    env::log_str(&format!("EVENT_JSON:{json}"));
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentRejected<'a> {
    owner_id: &'a AccountId,
    payment_id: &'a Hash32,
    invoice_hash: Hash32,
    decision: &'a Decision,
}
pub(crate) fn rejected(invoice: &InvoiceV1, decision: &Decision) {
    emit(
        "payment_rejected",
        PaymentRejected {
            owner_id: &invoice.owner_id,
            payment_id: &invoice.payment_id,
            invoice_hash: FixedBytes(invoice_hash(invoice)),
            decision,
        },
    );
}

/// Receipt-local samples for later runtime evidence. These observations alone
/// do not prove finality, refund ordering or the success of the native transfer.
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub(crate) struct DispatchBacking {
    pub runtime_balance_before_schedule_yocto: U128String,
    pub runtime_balance_after_schedule_yocto: U128String,
    pub required_before_transfer_yocto: U128String,
    pub total_available_after_reservation_yocto: U128String,
    pub total_storage_credit_after_charge_yocto: U128String,
    pub operating_reserve_yocto: U128String,
    pub storage_usage_after_charge_bytes: U64String,
    pub storage_byte_cost_yocto: U128String,
}
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentDispatched<'a> {
    owner_id: &'a AccountId,
    payment_id: &'a Hash32,
    invoice_hash: &'a Hash32,
    payout_account: &'a AccountId,
    amount_yocto: U128String,
    state: PaymentState,
    dispatched_at_ns: U64String,
    backing: DispatchBacking,
}
pub(crate) fn dispatched(payment: &PaymentRecord, backing: DispatchBacking) {
    emit(
        "payment_dispatched",
        PaymentDispatched {
            owner_id: &payment.invoice.owner_id,
            payment_id: &payment.invoice.payment_id,
            invoice_hash: &payment.invoice_hash,
            payout_account: &payment.invoice.payout_account,
            amount_yocto: payment.invoice.amount_yocto,
            state: payment.state,
            dispatched_at_ns: payment.dispatched_at_ns,
            backing,
        },
    );
}

/// Receipt-local post-write sample, not proof that a refund receipt has arrived.
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub(crate) struct BackingObservation {
    pub runtime_account_balance_yocto: U128String,
    pub total_available_yocto: U128String,
    pub total_storage_credit_yocto: U128String,
    pub operating_reserve_yocto: U128String,
    pub storage_usage_bytes: U64String,
    pub storage_byte_cost_yocto: U128String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct PaymentFinalized<'a> {
    owner_id: &'a AccountId,
    payment_id: &'a Hash32,
    invoice_hash: &'a Hash32,
    payout_account: &'a AccountId,
    amount_yocto: U128String,
    dispatch_day: U64String,
    state: PaymentState,
    finalized_at_ns: U64String,
    backing: BackingObservation,
}

pub(crate) fn payment_finalized(payment: &PaymentRecord, backing: BackingObservation) {
    emit(
        "payment_finalized",
        PaymentFinalized {
            owner_id: &payment.invoice.owner_id,
            payment_id: &payment.invoice.payment_id,
            invoice_hash: &payment.invoice_hash,
            payout_account: &payment.invoice.payout_account,
            amount_yocto: payment.invoice.amount_yocto,
            dispatch_day: payment.dispatch_day,
            state: payment.state,
            finalized_at_ns: payment.finalized_at_ns,
            backing,
        },
    );
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct WithdrawalEvent<'a, B: Serialize> {
    #[serde(flatten)]
    withdrawal: &'a WithdrawalRecord,
    payout_account: &'a AccountId,
    backing: B,
}

pub(crate) fn withdrawal_dispatched(withdrawal: &WithdrawalRecord, backing: DispatchBacking) {
    emit(
        "withdrawal_dispatched",
        WithdrawalEvent {
            withdrawal,
            payout_account: &withdrawal.owner_id,
            backing,
        },
    );
}

pub(crate) fn withdrawal_finalized(withdrawal: &WithdrawalRecord, backing: BackingObservation) {
    emit(
        "withdrawal_finalized",
        WithdrawalEvent {
            withdrawal,
            payout_account: &withdrawal.owner_id,
            backing,
        },
    );
}
