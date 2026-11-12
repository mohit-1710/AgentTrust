#[path = "../src/midnight_assertions.rs"]
mod rules;
use rules::{DAY_NS, Observed, checks};

#[test]
fn explicit_payment_gas_fits_the_finite_protocol_88_allowance() {
    let prepayment = u128::from(rules::PAYMENT_GAS_TGAS) * 1_000_000_000_000 * 1_000_000_000;
    assert_eq!(rules::PAYMENT_GAS_TGAS, 150);
    assert!(rules::WORKER_ALLOWANCE_YOCTO > prepayment + 1_000_000_000_000_000_000_000);
}

fn valid() -> Observed {
    Observed {
        dispatch_ns: DAY_NS - 2,
        edit_ns: DAY_NS,
        callback_ns: DAY_NS,
        amount: 3,
        available_before: 10,
        available_in_edit: 7,
        available_final: 7,
        pending_in_edit: 3,
        pending_final: 0,
        old_day_settled: 3,
        callback_day_settled: 0,
        recipient_delta: 3,
    }
}
#[test]
fn accepts_same_block_edit_only_with_committed_pending_return() {
    assert!(checks(&valid()).iter().all(|(_, pass)| *pass));
    let mut observed = valid();
    observed.pending_in_edit = 0;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
}
#[test]
fn rejects_same_day_late_edits_and_wrong_day_charges() {
    let mut observed = valid();
    observed.dispatch_ns = DAY_NS;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.edit_ns = observed.callback_ns + 1;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.old_day_settled = 0;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.callback_day_settled = 3;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
}
#[test]
fn rejects_released_principal_partial_reservation_or_duplicate_payout() {
    let mut observed = valid();
    observed.available_in_edit = 10;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.pending_in_edit = 2;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
    observed = valid();
    observed.recipient_delta = 6;
    assert!(checks(&observed).iter().any(|(_, pass)| !pass));
}
