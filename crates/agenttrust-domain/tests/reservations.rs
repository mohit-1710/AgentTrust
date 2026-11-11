use agenttrust_domain::{
    accounting::{
        AggregateLiabilities, PaymentError as E, PaymentRecord, PaymentState, TransferOutcome as O,
        charge_actor_storage, credit_deposit, existing_payment, finalize_payment, reserve_payment,
    },
    codec::invoice_hash,
    owner::{ActorState, SessionRegistration},
    policy::{
        self, BackingSnapshot, CredentialEvidence, DAY_NS, Decision, DenialCode as D,
        MAX_OUTSTANDING_TRANSFERS, MAX_RETAINED_PAYMENTS, MINUTE_NS, PolicySnapshot,
    },
    registry::{CredentialRef, ServiceIdentity},
    types::{FixedBytes, InvoiceV1, ProfileId, U64String, U128String},
};

const PRICE: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR
const NOW: u64 = 10 * DAY_NS + 10 * MINUTE_NS;
fn profile() -> ProfileId {
    ProfileId::new("audit".into()).unwrap()
}
fn service() -> ServiceIdentity {
    ServiceIdentity {
        service_id: "audit.testnet".parse().unwrap(),
        version: 1,
        payout_account: "seller.testnet".parse().unwrap(),
        invoice_key: FixedBytes([8; 32]),
        endpoint_hash: FixedBytes([9; 32]),
        active: true,
    }
}
fn session(id: u8) -> SessionRegistration {
    SessionRegistration {
        session_id: FixedBytes([id; 32]),
        public_key: format!("ed25519:fixture-{id}"),
        profile_id: profile(),
        profile_revision: 1,
        purchase_cap_yocto: U128String(3 * PRICE),
        expires_at_ns: U64String(u64::MAX),
    }
}
fn actor(name: &str) -> ActorState {
    let mut actor = ActorState::new(name.parse().unwrap());
    actor.ledger.available_yocto = U128String(10 * PRICE);
    actor.ledger.storage_credit_yocto = U128String(PRICE);
    actor.set_profile(profile(), None, None).unwrap();
    actor.register_session(session(1), NOW).unwrap();
    actor.register_session(session(2), NOW).unwrap();
    actor
        .set_service_trust(&service(), 1, vec![profile()], None, true, NOW)
        .unwrap();
    actor
        .set_policy(actor.policy.revision, U128String(5 * PRICE), 10, false)
        .unwrap();
    actor
}
fn totals(actor: &ActorState) -> AggregateLiabilities {
    AggregateLiabilities {
        available_yocto: actor.ledger.available_yocto.0,
        storage_credit_yocto: actor.ledger.storage_credit_yocto.0,
    }
}
fn invoice(actor: &ActorState, id: u8, amount: u128, now: u64) -> InvoiceV1 {
    InvoiceV1 {
        schema_version: 1,
        network: "near:testnet".into(),
        core_account: "core.testnet".parse().unwrap(),
        owner_id: actor.owner_id.clone(),
        session_id: FixedBytes([1; 32]),
        payment_id: FixedBytes([id; 32]),
        policy_revision: actor.policy.revision,
        profile_id: profile(),
        profile_revision: 1,
        service_id: service().service_id,
        service_version: 1,
        payout_account: service().payout_account,
        endpoint_hash: service().endpoint_hash,
        request_hash: FixedBytes([7; 32]),
        asset: "NEAR".into(),
        amount_yocto: U128String(amount),
        issued_at_ns: U64String(now),
        expires_at_ns: U64String(now + MINUTE_NS),
    }
}
fn evidence() -> CredentialRef {
    CredentialRef {
        issuer_id: "issuer.testnet".parse().unwrap(),
        credential_id: FixedBytes([11; 32]),
        revision: 1,
    }
}
fn decision(actor: &ActorState, quote: &InvoiceV1, backing: BackingSnapshot, now: u64) -> Decision {
    policy::evaluate(
        &PolicySnapshot {
            now_ns: now,
            network: "near:testnet",
            core_account: &quote.core_account,
            owner: actor,
            service: Some(&service()),
            signature_valid: true,
            usage: actor.usage.snapshot(now),
            backing,
        },
        quote,
        CredentialEvidence::default(),
    )
}

#[test]
fn competing_sessions_cannot_reserve_two_point_zero_three_under_point_zero_five() {
    let actor = actor("owner.testnet");
    let first = invoice(&actor, 1, 3 * PRICE, NOW);
    let reserved = reserve_payment(&actor, totals(&actor), &first, None, None, NOW).unwrap();
    assert_eq!(reserved.actor.ledger.available_yocto.0, 7 * PRICE);
    assert_eq!(reserved.actor.ledger.pending_payment_yocto.0, 3 * PRICE);
    assert_eq!(reserved.liabilities.available_yocto, 7 * PRICE);
    assert_eq!(reserved.actor.usage.dispatched_in_minute, 1);
    assert_eq!(reserved.actor.usage.outstanding_transfers, 1);
    assert_eq!(reserved.actor.usage.retained_payments, 1);
    assert_eq!(reserved.payment.invoice_hash.0, invoice_hash(&first));
    let mut second = invoice(&reserved.actor, 2, 3 * PRICE, NOW);
    second.session_id = FixedBytes([2; 32]);
    let before = reserved.clone();
    assert_eq!(
        reserve_payment(
            &reserved.actor,
            reserved.liabilities,
            &second,
            None,
            None,
            NOW
        ),
        Err(E::Denied(D::DailyCap))
    );
    assert_eq!(reserved, before);
    let failed = finalize_payment(
        &reserved.actor,
        reserved.liabilities,
        &reserved.payment,
        O::Failed,
        NOW + 1,
    )
    .unwrap();
    let next = reserve_payment(
        &failed.actor,
        failed.liabilities,
        &second,
        None,
        None,
        NOW + 2,
    )
    .unwrap();
    assert_eq!(next.actor.usage.dispatched_in_minute, 2);
    assert_eq!(next.actor.usage.retained_payments, 2);
}

#[test]
fn midnight_and_edits_preserve_all_day_pending_and_original_settlement_day() {
    let before_midnight = 11 * DAY_NS - 1;
    let next_day = 11 * DAY_NS + 1;
    let actor = actor("owner.testnet");
    let quote = invoice(&actor, 1, 3 * PRICE, before_midnight);
    let pending =
        reserve_payment(&actor, totals(&actor), &quote, None, None, before_midnight).unwrap();
    let mut edited = pending.actor.clone();
    let usage = edited.usage.clone();
    edited
        .set_policy(edited.policy.revision, U128String(5 * PRICE), 10, false)
        .unwrap();
    edited.set_profile(profile(), Some(1), None).unwrap();
    edited.revoke_session(&FixedBytes([1; 32])).unwrap();
    assert_eq!(edited.usage, usage);
    assert_eq!(edited.ledger, pending.actor.ledger);
    let new_quote = invoice(&edited, 2, 3 * PRICE, next_day);
    assert_eq!(
        reserve_payment(
            &edited,
            pending.liabilities,
            &new_quote,
            None,
            None,
            next_day
        ),
        Err(E::Denied(D::DailyCap))
    );
    // Finalization uses admission evidence, even after revocation/profile edits.
    let settled = finalize_payment(
        &edited,
        pending.liabilities,
        &pending.payment,
        O::Succeeded,
        next_day,
    )
    .unwrap();
    assert_eq!(settled.actor.ledger.pending_payment_yocto.0, 0);
    assert_eq!(
        settled.actor.usage.settled_by_dispatch_day[&10].0,
        3 * PRICE
    );
    assert_eq!(
        settled
            .actor
            .usage
            .snapshot(next_day)
            .settled_current_day_yocto,
        0
    );
    assert_eq!(settled.actor.usage.minute_bucket, usage.minute_bucket);
    assert_eq!(
        settled.actor.usage.dispatched_in_minute,
        usage.dispatched_in_minute
    );
    let next = reserve_payment(
        &settled.actor,
        settled.liabilities,
        &new_quote,
        None,
        None,
        next_day,
    )
    .unwrap();
    assert_eq!(next.actor.usage.minute_bucket.0, next_day / MINUTE_NS);
    assert_eq!(next.actor.usage.dispatched_in_minute, 1);
    assert_eq!(next.actor.usage.settled_by_dispatch_day.len(), 2);
}

#[test]
fn exact_retry_precedes_limits_and_preserves_original_evidence_and_outcome() {
    let actor = actor("owner.testnet");
    let quote = invoice(&actor, 1, PRICE, NOW);
    let pending =
        reserve_payment(&actor, totals(&actor), &quote, Some(&evidence()), None, NOW).unwrap();
    let mut edited = pending.actor.clone();
    edited.policy.paused = true;
    edited.policy.daily_cap_yocto = U128String(0);
    edited.policy.max_dispatches_per_minute = 0;
    edited.sessions.get_mut(&quote.session_id).unwrap().revoked = true;
    let mut changed_evidence = evidence();
    changed_evidence.revision = 2;
    let replay = reserve_payment(
        &edited,
        pending.liabilities,
        &quote,
        Some(&changed_evidence),
        Some(&pending.payment),
        NOW + DAY_NS,
    )
    .unwrap();
    assert!(replay.duplicate);
    assert_eq!(replay.actor, edited);
    assert_eq!(replay.liabilities, pending.liabilities);
    assert_eq!(replay.payment, pending.payment);
    let mut changed = quote.clone();
    changed.amount_yocto = U128String(2 * PRICE);
    assert_eq!(
        existing_payment(Some(&pending.payment), &changed),
        Err(E::Denied(D::PaymentIdConflict))
    );
    assert_eq!(
        reserve_payment(
            &edited,
            pending.liabilities,
            &changed,
            None,
            Some(&pending.payment),
            NOW
        ),
        Err(E::Denied(D::PaymentIdConflict))
    );
    assert_eq!(existing_payment(None, &quote), Ok(None));
    for outcome in [O::Succeeded, O::Failed] {
        let terminal = finalize_payment(
            &edited,
            pending.liabilities,
            &pending.payment,
            outcome,
            NOW + 1,
        )
        .unwrap();
        for repeat in [O::Succeeded, O::Failed] {
            let duplicate = finalize_payment(
                &terminal.actor,
                terminal.liabilities,
                &terminal.payment,
                repeat,
                NOW + DAY_NS,
            )
            .unwrap();
            assert!(duplicate.duplicate);
            assert_eq!(duplicate.actor, terminal.actor);
            assert_eq!(duplicate.liabilities, terminal.liabilities);
            assert_eq!(duplicate.payment, terminal.payment);
        }
        assert_eq!(
            existing_payment(Some(&terminal.payment), &quote),
            Ok(Some(terminal.payment))
        );
    }
}

#[test]
fn callbacks_do_not_increase_complete_actor_or_payment_storage() {
    for credential in [None, Some(evidence())] {
        let actor = actor("owner.testnet");
        let quote = invoice(&actor, 1, PRICE, NOW);
        let pending = reserve_payment(
            &actor,
            totals(&actor),
            &quote,
            credential.as_ref(),
            None,
            NOW,
        )
        .unwrap();
        let actor_bytes = borsh::to_vec(&pending.actor).unwrap().len();
        let record_bytes = borsh::to_vec(&pending.payment).unwrap().len();
        assert_eq!(
            pending.actor.usage.settled_by_dispatch_day[&(NOW / DAY_NS)].0,
            0
        );
        assert_eq!(pending.payment.finalized_at_ns.0, 0);
        for outcome in [O::Succeeded, O::Failed] {
            let terminal = finalize_payment(
                &pending.actor,
                pending.liabilities,
                &pending.payment,
                outcome,
                u64::MAX,
            )
            .unwrap();
            assert_eq!(borsh::to_vec(&terminal.actor).unwrap().len(), actor_bytes);
            assert_eq!(
                borsh::to_vec(&terminal.payment).unwrap().len(),
                record_bytes
            );
            assert_eq!(terminal.payment.finalized_at_ns.0, u64::MAX);
            assert_eq!(terminal.payment.invoice, pending.payment.invoice);
            assert_eq!(terminal.payment.credential, credential);
        }
    }
}

#[test]
fn reserve_rechecks_funds_caps_rate_bounds_and_checked_aggregate() {
    for (change, expected) in [
        (0, E::Denied(D::PurchaseCap)),
        (1, E::Denied(D::DailyCap)),
        (2, E::Denied(D::RateLimit)),
        (3, E::Denied(D::InsufficientFunds)),
        (4, E::Denied(D::Capacity)),
        (5, E::Denied(D::Capacity)),
        (6, E::InconsistentState),
        (7, E::Denied(D::DailyCap)),
        (8, E::Denied(D::InvalidInvoice)),
        (9, E::Denied(D::Unauthorized)),
    ] {
        let mut actor = actor("owner.testnet");
        let mut quote = invoice(&actor, 1, PRICE, NOW);
        let mut liabilities = totals(&actor);
        match change {
            0 => {
                actor
                    .sessions
                    .get_mut(&quote.session_id)
                    .unwrap()
                    .purchase_cap_yocto = U128String(PRICE - 1)
            }
            1 => actor.policy.daily_cap_yocto = U128String(PRICE - 1),
            2 => {
                actor.usage.minute_bucket = U64String(NOW / MINUTE_NS);
                actor.usage.dispatched_in_minute = actor.policy.max_dispatches_per_minute;
            }
            3 => actor.ledger.available_yocto = U128String(PRICE - 1),
            4 => actor.usage.outstanding_transfers = MAX_OUTSTANDING_TRANSFERS,
            5 => actor.usage.retained_payments = MAX_RETAINED_PAYMENTS,
            6 => liabilities.available_yocto = PRICE - 1,
            7 => {
                actor.policy.daily_cap_yocto = U128String(u128::MAX);
                actor.ledger.pending_payment_yocto = U128String(u128::MAX);
            }
            8 => quote.amount_yocto = U128String(0),
            _ => quote.owner_id = "other.testnet".parse().unwrap(),
        }
        let before = borsh::to_vec(&actor).unwrap();
        assert_eq!(
            reserve_payment(&actor, liabilities, &quote, None, None, NOW),
            Err(expected),
            "case {change}"
        );
        assert_eq!(borsh::to_vec(&actor).unwrap(), before);
    }
}

#[test]
fn finalization_errors_leave_all_inputs_unchanged() {
    let actor = actor("owner.testnet");
    let quote = invoice(&actor, 1, PRICE, NOW);
    let pending = reserve_payment(&actor, totals(&actor), &quote, None, None, NOW).unwrap();
    for change in 0..6 {
        let mut actor = pending.actor.clone();
        let mut liabilities = pending.liabilities;
        let outcome = if change < 2 { O::Failed } else { O::Succeeded };
        let expected = if change < 3 {
            E::ArithmeticOverflow
        } else {
            E::InconsistentState
        };
        match change {
            0 => actor.ledger.available_yocto = U128String(u128::MAX),
            1 => liabilities.available_yocto = u128::MAX,
            2 => {
                actor
                    .usage
                    .settled_by_dispatch_day
                    .insert(NOW / DAY_NS, U128String(u128::MAX));
            }
            3 => actor.ledger.pending_payment_yocto = U128String(PRICE - 1),
            4 => actor.usage.outstanding_transfers = 0,
            _ => actor.usage.settled_by_dispatch_day.clear(),
        }
        let before = borsh::to_vec(&actor).unwrap();
        let record_before = pending.payment.clone();
        assert_eq!(
            finalize_payment(&actor, liabilities, &pending.payment, outcome, NOW + 1),
            Err(expected),
            "case {change}"
        );
        assert_eq!(borsh::to_vec(&actor).unwrap(), before);
        assert_eq!(pending.payment, record_before);
    }
}

#[test]
fn sequence_conservation_holds_across_owners_outcomes_and_callback_orders() {
    for outcomes in 0..8 {
        for order in [[0, 1, 2], [2, 0, 1], [1, 2, 0]] {
            let mut actors = [actor("one.testnet"), actor("two.testnet")];
            actors[0].usage.outstanding_transfers = 1; // unrelated owner withdrawal
            let mut liabilities = AggregateLiabilities {
                available_yocto: 20 * PRICE,
                storage_credit_yocto: 2 * PRICE,
            };
            let mut records = Vec::<(usize, PaymentRecord)>::new();
            for id in 0..3 {
                let owner = id % 2;
                let quote = invoice(&actors[owner], id as u8, PRICE, NOW);
                let next =
                    reserve_payment(&actors[owner], liabilities, &quote, None, None, NOW).unwrap();
                actors[owner] = next.actor;
                liabilities = next.liabilities;
                records.push((owner, next.payment));
                assert_conservation(&actors, liabilities, &records);
            }
            for index in order {
                let (owner, record) = &records[index];
                let outcome = if outcomes & (1 << index) == 0 {
                    O::Failed
                } else {
                    O::Succeeded
                };
                let next =
                    finalize_payment(&actors[*owner], liabilities, record, outcome, NOW + DAY_NS)
                        .unwrap();
                actors[*owner] = next.actor;
                liabilities = next.liabilities;
                records[index].1 = next.payment;
                assert_conservation(&actors, liabilities, &records);
            }
        }
    }
}
fn assert_conservation(
    actors: &[ActorState; 2],
    liabilities: AggregateLiabilities,
    records: &[(usize, PaymentRecord)],
) {
    assert_eq!(
        liabilities.available_yocto,
        actors.iter().map(|a| a.ledger.available_yocto.0).sum()
    );
    assert_eq!(liabilities.storage_credit_yocto, 2 * PRICE);
    for (owner, actor) in actors.iter().enumerate() {
        let pending: u128 = records
            .iter()
            .filter(|(i, r)| *i == owner && r.state == PaymentState::Pending)
            .map(|(_, r)| r.invoice.amount_yocto.0)
            .sum();
        let settled: u128 = records
            .iter()
            .filter(|(i, r)| *i == owner && r.state == PaymentState::Settled)
            .map(|(_, r)| r.invoice.amount_yocto.0)
            .sum();
        assert_eq!(actor.ledger.pending_payment_yocto.0, pending);
        assert_eq!(
            actor.ledger.available_yocto.0 + pending + settled,
            10 * PRICE
        );
        assert_eq!(
            actor
                .usage
                .settled_by_dispatch_day
                .values()
                .map(|v| v.0)
                .sum::<u128>(),
            settled
        );
        assert_eq!(
            actor.usage.outstanding_transfers,
            (pending / PRICE) as u32 + u32::from(owner == 0)
        );
        let attempts = records.iter().filter(|(i, _)| *i == owner).count() as u32;
        assert_eq!(actor.usage.dispatched_in_minute, attempts);
        assert_eq!(actor.usage.retained_payments, attempts);
    }
}

#[test]
fn retained_failures_bound_day_buckets_and_outstanding_is_shared_with_withdrawals() {
    let mut actor = actor("owner.testnet");
    let mut liabilities = totals(&actor);
    actor.usage.outstanding_transfers = MAX_OUTSTANDING_TRANSFERS - 1;
    for id in 0..MAX_RETAINED_PAYMENTS {
        let now = NOW + u64::from(id) * DAY_NS;
        let quote = invoice(&actor, id as u8, PRICE, now);
        let pending = reserve_payment(&actor, liabilities, &quote, None, None, now).unwrap();
        assert_eq!(
            pending.actor.usage.outstanding_transfers,
            MAX_OUTSTANDING_TRANSFERS
        );
        let another = invoice(&pending.actor, 255, PRICE, now);
        assert_eq!(
            reserve_payment(
                &pending.actor,
                pending.liabilities,
                &another,
                None,
                None,
                now
            ),
            Err(E::Denied(D::Capacity))
        );
        let failed = finalize_payment(
            &pending.actor,
            pending.liabilities,
            &pending.payment,
            O::Failed,
            now + 1,
        )
        .unwrap();
        actor = failed.actor;
        liabilities = failed.liabilities;
    }
    assert_eq!(actor.usage.retained_payments, MAX_RETAINED_PAYMENTS);
    assert_eq!(
        actor.usage.settled_by_dispatch_day.len(),
        MAX_RETAINED_PAYMENTS as usize
    );
    assert_eq!(actor.ledger.available_yocto.0, 10 * PRICE);
    let now = NOW + u64::from(MAX_RETAINED_PAYMENTS) * DAY_NS;
    let quote = invoice(&actor, 255, PRICE, now);
    assert_eq!(
        reserve_payment(&actor, liabilities, &quote, None, None, now),
        Err(E::Denied(D::Capacity))
    );
}

#[test]
fn every_management_and_funding_path_preserves_usage() {
    let actor = actor("owner.testnet");
    let quote = invoice(&actor, 1, PRICE, NOW);
    let pending = reserve_payment(&actor, totals(&actor), &quote, None, None, NOW).unwrap();
    let usage = pending.actor.usage.clone();
    let mut updated = pending.actor;
    updated
        .set_policy(updated.policy.revision, U128String(6 * PRICE), 8, true)
        .unwrap();
    updated.register_session(session(3), NOW).unwrap();
    updated.revoke_session(&quote.session_id).unwrap();
    updated.set_profile(profile(), Some(1), None).unwrap();
    updated
        .set_service_trust(&service(), 1, vec![profile()], None, false, NOW)
        .unwrap();
    updated.block_service(service().service_id, true).unwrap();
    updated
        .block_payout(service().payout_account, true)
        .unwrap();
    assert_eq!(updated.usage, usage);
    let funded = credit_deposit(&updated, pending.liabilities, PRICE, PRICE / 2).unwrap();
    let charged = charge_actor_storage(&funded.actor, funded.liabilities, 5, 10).unwrap();
    assert_eq!(charged.actor.usage, usage);
    assert_eq!(charged.actor.ledger.pending_payment_yocto.0, PRICE);
}

#[test]
fn new_outflow_uses_actual_balance_after_failure_until_refund_is_observed() {
    let actor = actor("owner.testnet");
    let quote = invoice(&actor, 1, PRICE, NOW);
    // Exact backing, with no unrelated unclaimed surplus to mask a shortfall.
    let mut backing = BackingSnapshot {
        runtime_balance_yocto: 14 * PRICE,
        storage_stake_yocto: PRICE,
        operating_reserve_yocto: 2 * PRICE,
        aggregate_available_yocto: 10 * PRICE,
        aggregate_storage_credit_yocto: PRICE,
        storage_charge_yocto: 0,
    };
    assert_eq!(decision(&actor, &quote, backing, NOW), Decision::Allow);
    let pending = reserve_payment(&actor, totals(&actor), &quote, None, None, NOW).unwrap();
    backing.runtime_balance_yocto -= PRICE; // observed transfer deduction
    backing.aggregate_available_yocto = pending.liabilities.available_yocto;
    let next_quote = invoice(&pending.actor, 2, PRICE, NOW);
    // Pending principal is already out of B and A; do not subtract it twice.
    assert_eq!(
        decision(&pending.actor, &next_quote, backing, NOW),
        Decision::Allow
    );
    let failed = finalize_payment(
        &pending.actor,
        pending.liabilities,
        &pending.payment,
        O::Failed,
        NOW + 1,
    )
    .unwrap();
    backing.aggregate_available_yocto = failed.liabilities.available_yocto;
    assert_eq!(
        decision(&failed.actor, &next_quote, backing, NOW + 1),
        Decision::deny(D::InsufficientBacking)
    );
    backing.runtime_balance_yocto += PRICE; // actual refund is now visible
    assert_eq!(
        decision(&failed.actor, &next_quote, backing, NOW + 1),
        Decision::Allow
    );
}
