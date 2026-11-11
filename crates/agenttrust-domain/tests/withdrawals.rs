use agenttrust_domain::{
    accounting::{AggregateLiabilities, TransferOutcome as O},
    owner::ActorState,
    policy::{BackingSnapshot, MAX_OUTSTANDING_TRANSFERS},
    types::{FixedBytes, U64String, U128String},
    withdrawals::{
        WithdrawalDisplayState as Display, WithdrawalError as E, WithdrawalState as S,
        WithdrawalView, existing_withdrawal, finalize_withdrawal, precheck_withdrawal_backing,
        reserve_withdrawal, withdrawal_storage_bound,
    },
};

fn actor() -> ActorState {
    let mut actor = ActorState::new("owner.testnet".parse().unwrap());
    actor.ledger.available_yocto = U128String(100);
    actor.ledger.storage_credit_yocto = U128String(25);
    actor.ledger.pending_payment_yocto = U128String(30);
    actor.usage.outstanding_transfers = 1;
    actor.usage.dispatched_in_minute = 5;
    actor.usage.minute_bucket = U64String(7);
    actor.usage.retained_payments = 1;
    actor
        .usage
        .settled_by_dispatch_day
        .insert(2, U128String(10));
    actor
}

fn backing(balance: u128, storage_charge: u128) -> BackingSnapshot {
    BackingSnapshot {
        runtime_balance_yocto: balance,
        storage_stake_yocto: 40,
        operating_reserve_yocto: 5,
        aggregate_available_yocto: totals().available_yocto,
        aggregate_storage_credit_yocto: totals().storage_credit_yocto,
        storage_charge_yocto: storage_charge,
    }
}

#[test]
fn storage_projection_pairs_new_stake_with_reduced_credit_without_using_principal() {
    let owner = actor();
    assert_eq!(
        precheck_withdrawal_backing(&owner, backing(420, 10)),
        Ok(())
    );
    assert_eq!(
        precheck_withdrawal_backing(&owner, backing(419, 10)),
        Err(E::InsufficientBacking)
    );
    assert_eq!(
        precheck_withdrawal_backing(&owner, backing(1000, 26)),
        Err(E::StorageCredit)
    );
    let mut inconsistent = backing(1000, 10);
    inconsistent.aggregate_storage_credit_yocto = 9;
    assert_eq!(
        precheck_withdrawal_backing(&owner, inconsistent),
        Err(E::StorageCredit)
    );
    let mut overflow = backing(u128::MAX, 1);
    overflow.storage_stake_yocto = u128::MAX;
    assert_eq!(
        precheck_withdrawal_backing(&owner, overflow),
        Err(E::ArithmeticOverflow)
    );
    assert_eq!(owner, actor());
}

#[test]
fn failure_restores_claim_but_actual_refund_gap_prevents_another_outflow() {
    let r = reserve_withdrawal(
        &actor(),
        totals(),
        FixedBytes([1; 32]),
        U128String(60),
        None,
        1,
    )
    .unwrap();
    let mut after_schedule = backing(360, 0);
    after_schedule.aggregate_available_yocto = r.liabilities.available_yocto;
    assert_eq!(
        precheck_withdrawal_backing(&r.actor, after_schedule),
        Ok(())
    );
    let failed = finalize_withdrawal(&r.actor, r.liabilities, &r.withdrawal, O::Failed, 2).unwrap();
    after_schedule.aggregate_available_yocto = failed.liabilities.available_yocto;
    assert_eq!(
        precheck_withdrawal_backing(&failed.actor, after_schedule),
        Err(E::InsufficientBacking)
    );
    after_schedule.runtime_balance_yocto += 60;
    assert_eq!(
        precheck_withdrawal_backing(&failed.actor, after_schedule),
        Ok(())
    );
}

#[test]
fn storage_bound_covers_maximal_owner_key_and_fixed_record_without_owner_index() {
    let mut owner = actor();
    owner.owner_id = "a".repeat(64).parse().unwrap();
    let r = reserve_withdrawal(
        &owner,
        totals(),
        FixedBytes([1; 32]),
        U128String(60),
        None,
        1,
    )
    .unwrap();
    let value_bytes = borsh::to_vec(&r.withdrawal).unwrap().len() as u64;
    let key_bytes = borsh::to_vec(&(owner.owner_id, FixedBytes([1; 32])))
        .unwrap()
        .len() as u64;
    assert!(withdrawal_storage_bound(&r.withdrawal) >= value_bytes + key_bytes + 40);
    assert!(withdrawal_storage_bound(&r.withdrawal) <= value_bytes + 512);
}

#[test]
fn reconciliation_view_preserves_record_claims_and_fixed_owner_destination() {
    let r = reserve_withdrawal(
        &actor(),
        totals(),
        FixedBytes([1; 32]),
        U128String(60),
        None,
        1,
    )
    .unwrap();
    let before = r.clone();
    let pending = WithdrawalView::new(r.withdrawal.clone(), 120_000_000_000);
    assert_eq!(pending.display_state, Display::Pending);
    let diagnostic = WithdrawalView::new(r.withdrawal.clone(), 120_000_000_001);
    assert_eq!(diagnostic.display_state, Display::NeedsReconciliation);
    assert_eq!(diagnostic.record, r.withdrawal);
    assert_eq!(diagnostic.payout_account, r.actor.owner_id);
    assert_eq!(r, before);
    for (outcome, expected) in [
        (O::Succeeded, Display::Succeeded),
        (O::Failed, Display::Failed),
    ] {
        let finalized =
            finalize_withdrawal(&r.actor, r.liabilities, &r.withdrawal, outcome, 2).unwrap();
        assert_eq!(
            WithdrawalView::new(finalized.withdrawal, u64::MAX).display_state,
            expected
        );
    }
}
fn totals() -> AggregateLiabilities {
    AggregateLiabilities {
        available_yocto: 300,
        storage_credit_yocto: 75,
    }
}

#[test]
fn withdrawal_debits_available_only_and_shares_capacity_without_spending_worker_budget() {
    let actor = actor();
    let r = reserve_withdrawal(
        &actor,
        totals(),
        FixedBytes([1; 32]),
        U128String(100),
        None,
        1000,
    )
    .unwrap();
    assert_eq!(r.actor.ledger.available_yocto.0, 0);
    assert_eq!(r.liabilities.available_yocto, 200);
    assert_eq!(
        r.actor.ledger.pending_payment_yocto,
        actor.ledger.pending_payment_yocto
    );
    assert_eq!(
        r.actor.ledger.storage_credit_yocto,
        actor.ledger.storage_credit_yocto
    );
    assert_eq!(
        r.liabilities.storage_credit_yocto,
        totals().storage_credit_yocto
    );
    assert_eq!(r.actor.usage.outstanding_transfers, 2);
    let mut expected = actor.clone();
    expected.ledger.available_yocto = U128String(0);
    expected.usage.outstanding_transfers = 2;
    assert_eq!(r.actor, expected);
    assert_eq!(r.withdrawal.owner_id, actor.owner_id);
    assert_eq!(r.withdrawal.state, S::Pending);
    assert!(!r.duplicate);
}

#[test]
fn pending_payment_storage_and_operating_claims_cannot_be_withdrawn() {
    let actor = actor();
    for amount in [101, 125, 130, u128::MAX] {
        assert_eq!(
            reserve_withdrawal(
                &actor,
                totals(),
                FixedBytes([1; 32]),
                U128String(amount),
                None,
                1
            ),
            Err(E::InsufficientFunds)
        );
    }
    assert_eq!(
        reserve_withdrawal(
            &actor,
            totals(),
            FixedBytes([1; 32]),
            U128String(0),
            None,
            1
        ),
        Err(E::InvalidAmount)
    );
}

#[test]
fn exact_retry_preserves_original_record_even_when_current_available_and_capacity_changed() {
    let r = reserve_withdrawal(
        &actor(),
        totals(),
        FixedBytes([1; 32]),
        U128String(70),
        None,
        1000,
    )
    .unwrap();
    let mut current = r.actor.clone();
    current.ledger.available_yocto = U128String(0);
    current.usage.outstanding_transfers = MAX_OUTSTANDING_TRANSFERS;
    let retry = reserve_withdrawal(
        &current,
        r.liabilities,
        FixedBytes([1; 32]),
        U128String(70),
        Some(&r.withdrawal),
        9999,
    )
    .unwrap();
    assert!(retry.duplicate);
    assert_eq!(retry.actor, current);
    assert_eq!(retry.liabilities, r.liabilities);
    assert_eq!(retry.withdrawal, r.withdrawal);
    assert_eq!(
        existing_withdrawal(
            Some(&r.withdrawal),
            &current.owner_id,
            &FixedBytes([1; 32]),
            U128String(71)
        ),
        Err(E::IdConflict)
    );
    assert_eq!(
        existing_withdrawal(
            Some(&r.withdrawal),
            &current.owner_id,
            &FixedBytes([2; 32]),
            U128String(70)
        ),
        Err(E::IdConflict)
    );
    assert_eq!(
        existing_withdrawal(
            Some(&r.withdrawal),
            &"other.testnet".parse().unwrap(),
            &FixedBytes([1; 32]),
            U128String(70)
        ),
        Err(E::IdConflict)
    );
}

#[test]
fn shared_outstanding_bound_does_not_reset_existing_payment_usage() {
    let mut current = actor();
    current.usage.outstanding_transfers = MAX_OUTSTANDING_TRANSFERS;
    let before = current.clone();
    assert_eq!(
        reserve_withdrawal(
            &current,
            totals(),
            FixedBytes([1; 32]),
            U128String(1),
            None,
            1
        ),
        Err(E::Capacity)
    );
    assert_eq!(current, before);
}

#[test]
fn success_and_failure_conserve_claims_and_duplicate_or_opposite_callbacks_are_noops() {
    for outcome in [O::Succeeded, O::Failed] {
        let before = actor();
        let r = reserve_withdrawal(
            &before,
            totals(),
            FixedBytes([1; 32]),
            U128String(60),
            None,
            1000,
        )
        .unwrap();
        let f = finalize_withdrawal(&r.actor, r.liabilities, &r.withdrawal, outcome, 2000).unwrap();
        assert_eq!(f.actor.usage, before.usage);
        let restored = outcome == O::Failed;
        assert_eq!(
            f.actor.ledger.available_yocto.0,
            if restored { 100 } else { 40 }
        );
        assert_eq!(
            f.liabilities.available_yocto,
            if restored { 300 } else { 240 }
        );
        assert_eq!(
            f.withdrawal.state,
            if restored { S::Failed } else { S::Succeeded }
        );
        assert_eq!(f.withdrawal.finalized_at_ns.0, 2000);
        for repeated in [O::Succeeded, O::Failed] {
            let duplicate =
                finalize_withdrawal(&f.actor, f.liabilities, &f.withdrawal, repeated, 3000)
                    .unwrap();
            assert!(duplicate.duplicate);
            assert_eq!(duplicate.actor, f.actor);
            assert_eq!(duplicate.liabilities, f.liabilities);
            assert_eq!(duplicate.withdrawal, f.withdrawal);
        }
        let replay = reserve_withdrawal(
            &f.actor,
            f.liabilities,
            FixedBytes([1; 32]),
            U128String(60),
            Some(&f.withdrawal),
            4000,
        )
        .unwrap();
        assert!(replay.duplicate);
        assert_eq!(replay.withdrawal, f.withdrawal);
    }
}

#[test]
fn callback_storage_has_fixed_actor_and_record_width() {
    let r = reserve_withdrawal(
        &actor(),
        totals(),
        FixedBytes([1; 32]),
        U128String(60),
        None,
        1000,
    )
    .unwrap();
    for outcome in [O::Succeeded, O::Failed] {
        let f =
            finalize_withdrawal(&r.actor, r.liabilities, &r.withdrawal, outcome, u64::MAX).unwrap();
        assert_eq!(
            borsh::to_vec(&r.actor).unwrap().len(),
            borsh::to_vec(&f.actor).unwrap().len()
        );
        assert_eq!(
            borsh::to_vec(&r.withdrawal).unwrap().len(),
            borsh::to_vec(&f.withdrawal).unwrap().len()
        );
    }
}

#[test]
fn arithmetic_and_inconsistent_state_errors_leave_inputs_unchanged() {
    let before = actor();
    let mut bad_totals = totals();
    bad_totals.available_yocto = 0;
    assert_eq!(
        reserve_withdrawal(
            &before,
            bad_totals,
            FixedBytes([1; 32]),
            U128String(1),
            None,
            1
        ),
        Err(E::InconsistentState)
    );
    let r = reserve_withdrawal(
        &before,
        totals(),
        FixedBytes([1; 32]),
        U128String(60),
        None,
        1000,
    )
    .unwrap();
    let mut bad_actor = r.actor.clone();
    bad_actor.usage.outstanding_transfers = 0;
    assert_eq!(
        finalize_withdrawal(&bad_actor, r.liabilities, &r.withdrawal, O::Failed, 2),
        Err(E::InconsistentState)
    );
    bad_actor = r.actor.clone();
    bad_actor.ledger.available_yocto = U128String(u128::MAX);
    assert_eq!(
        finalize_withdrawal(&bad_actor, r.liabilities, &r.withdrawal, O::Failed, 2),
        Err(E::ArithmeticOverflow)
    );
    bad_totals.available_yocto = u128::MAX;
    assert_eq!(
        finalize_withdrawal(&r.actor, bad_totals, &r.withdrawal, O::Failed, 2),
        Err(E::ArithmeticOverflow)
    );
    let mut other = r.actor.clone();
    other.owner_id = "other.testnet".parse().unwrap();
    assert_eq!(
        finalize_withdrawal(&other, r.liabilities, &r.withdrawal, O::Succeeded, 2),
        Err(E::InconsistentState)
    );
    assert_eq!(before, actor());
}
