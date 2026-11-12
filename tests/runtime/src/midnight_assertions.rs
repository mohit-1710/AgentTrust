//! Pure acceptance rules, shared by the separate fixture and ordinary-value tests.
pub const DAY_NS: u64 = 86_400_000_000_000;
pub const PAYMENT_GAS_TGAS: u64 = 150;
pub const WORKER_ALLOWANCE_YOCTO: u128 = 1_000_000_000_000_000_000_000_000;

pub struct Observed {
    pub dispatch_ns: u64,
    pub edit_ns: u64,
    pub callback_ns: u64,
    pub amount: u128,
    pub available_before: u128,
    pub available_in_edit: u128,
    pub available_final: u128,
    pub pending_in_edit: u128,
    pub pending_final: u128,
    pub old_day_settled: u128,
    pub callback_day_settled: u128,
    pub recipient_delta: u128,
}

pub fn checks(o: &Observed) -> Vec<(&'static str, bool)> {
    vec![
        (
            "dispatch precedes midnight and callback follows it",
            o.dispatch_ns / DAY_NS < o.callback_ns / DAY_NS,
        ),
        (
            "edit receipt lies between dispatch and callback blocks",
            o.dispatch_ns <= o.edit_ns && o.edit_ns <= o.callback_ns,
        ),
        // A committed edit receipt returning pending principal proves that edit
        // precedes settlement even if both receipts share a block timestamp.
        (
            "committed post-edit return retains the entire pending principal",
            o.amount > 0 && o.pending_in_edit == o.amount,
        ),
        (
            "edits preserve the principal debit",
            o.available_before.checked_sub(o.amount) == Some(o.available_in_edit),
        ),
        (
            "successful callback clears pending without restoring principal",
            o.pending_final == 0 && o.available_final == o.available_in_edit,
        ),
        (
            "callback credits only the original dispatch-day bucket",
            o.old_day_settled == o.amount && o.callback_day_settled == 0,
        ),
        (
            "recipient receives exactly one native payout",
            o.recipient_delta == o.amount,
        ),
    ]
}
