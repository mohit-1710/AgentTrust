use agenttrust_domain::{
    accounting::{AggregateLiabilities, PaymentRecord, PaymentState},
    authority::CallContext,
    codec::encode_invoice,
    owner::{ActorState, SessionRegistration},
    payments::{AdmissionSnapshot, PaymentAdmission, admit_payment, payment_storage_bound},
    policy::{BackingSnapshot, CredentialEvidence, Decision, DenialCode},
    registry::{CredentialRef, ServiceIdentity},
    types::{AccountId, FixedBytes, InvoiceV1, ProfileId, SignedInvoiceV1, U64String, U128String},
};
use std::cell::Cell;
const NOW: u64 = 1_800_000_000_000_000_000;
fn account(s: &str) -> AccountId {
    s.parse().unwrap()
}
struct Fixture {
    owner: ActorState,
    core: AccountId,
    service: ServiceIdentity,
    quote: SignedInvoiceV1,
    backing: BackingSnapshot,
}
impl Fixture {
    fn new() -> Self {
        let core = account("core.testnet");
        let mut owner = ActorState::new(account("owner.testnet"));
        owner.ledger.available_yocto = U128String(1_000_000);
        owner.ledger.storage_credit_yocto = U128String(100_000);
        let profile_id = ProfileId::new("audit".into()).unwrap();
        owner.set_profile(profile_id.clone(), None, None).unwrap();
        owner
            .register_session(
                SessionRegistration {
                    session_id: FixedBytes([3; 32]),
                    public_key: "ed25519:worker".into(),
                    profile_id: profile_id.clone(),
                    profile_revision: 1,
                    purchase_cap_yocto: U128String(100_000),
                    expires_at_ns: U64String(NOW + 1_000_000_000_000),
                },
                NOW,
            )
            .unwrap();
        owner
            .set_policy(owner.policy.revision, U128String(500_000), 5, false)
            .unwrap();
        let service = ServiceIdentity {
            service_id: account("audit.testnet"),
            version: 1,
            payout_account: account("seller.testnet"),
            invoice_key: FixedBytes([7; 32]),
            endpoint_hash: FixedBytes([8; 32]),
            active: true,
        };
        owner
            .set_service_trust(&service, 1, vec![profile_id.clone()], None, true, NOW)
            .unwrap();
        let quote = SignedInvoiceV1 {
            invoice: InvoiceV1 {
                schema_version: 1,
                network: "near:testnet".into(),
                core_account: core.clone(),
                owner_id: owner.owner_id.clone(),
                session_id: FixedBytes([3; 32]),
                payment_id: FixedBytes([4; 32]),
                policy_revision: owner.policy.revision,
                profile_id,
                profile_revision: 1,
                service_id: service.service_id.clone(),
                service_version: 1,
                payout_account: service.payout_account.clone(),
                endpoint_hash: service.endpoint_hash,
                request_hash: FixedBytes([9; 32]),
                asset: "NEAR".into(),
                amount_yocto: U128String(30_000),
                issued_at_ns: U64String(NOW),
                expires_at_ns: U64String(NOW + 120_000_000_000),
            },
            signature: FixedBytes([10; 64]),
        };
        let backing = BackingSnapshot {
            runtime_balance_yocto: 1_120_000,
            storage_stake_yocto: 10_000,
            operating_reserve_yocto: 10_000,
            aggregate_available_yocto: 1_000_000,
            aggregate_storage_credit_yocto: 100_000,
            storage_charge_yocto: 10_000,
        };
        Self {
            owner,
            core,
            service,
            quote,
            backing,
        }
    }
    fn context(&self) -> CallContext<'_> {
        CallContext {
            current_account: &self.core,
            predecessor: &self.owner.owner_id,
            signer: &self.owner.owner_id,
            signer_public_key: "ed25519:worker",
            attached_deposit_yocto: 0,
        }
    }
    fn snapshot<'a>(&'a self, call: &'a CallContext<'a>) -> AdmissionSnapshot<'a> {
        AdmissionSnapshot {
            call,
            now_ns: NOW,
            network: "near:testnet",
            owner: Some(&self.owner),
            service: Some(&self.service),
            backing: self.backing,
        }
    }
    fn reserve(&self) -> agenttrust_domain::accounting::PaymentAccounting {
        let call = self.context();
        match admit_payment(
            &self.snapshot(&call),
            &self.quote,
            CredentialEvidence::default(),
            None,
            |_, _, _| true,
        )
        .unwrap()
        {
            PaymentAdmission::Reserved(state) => state,
            other => panic!("unexpected {other:?}"),
        }
    }
}
fn rejected(result: PaymentAdmission, code: DenialCode) {
    assert_eq!(result, PaymentAdmission::Rejected(Decision::deny(code)));
}
#[test]
fn registered_key_and_canonical_bytes_are_the_only_verification_inputs() {
    let f = Fixture::new();
    let call = f.context();
    let calls = Cell::new(0);
    let result = admit_payment(
        &f.snapshot(&call),
        &f.quote,
        CredentialEvidence::default(),
        None,
        |signature, bytes, key| {
            calls.set(calls.get() + 1);
            assert_eq!(signature, &f.quote.signature.0);
            assert_eq!(bytes, encode_invoice(&f.quote.invoice));
            assert_eq!(key, &f.service.invoice_key.0);
            true
        },
    )
    .unwrap();
    assert!(matches!(result, PaymentAdmission::Reserved(_)));
    assert_eq!(calls.get(), 1);
    rejected(
        admit_payment(
            &f.snapshot(&call),
            &f.quote,
            CredentialEvidence::default(),
            None,
            |_, _, _| false,
        )
        .unwrap(),
        DenialCode::InvalidInvoice,
    );
}
#[test]
fn actual_caller_authentication_precedes_duplicate_and_signature_work() {
    let f = Fixture::new();
    let payment = f.reserve().payment;
    let stranger = account("stranger.testnet");
    for variant in 0..4 {
        let mut call = f.context();
        match variant {
            0 => call.signer = &stranger,
            1 => call.predecessor = &stranger,
            2 => call.signer_public_key = "ed25519:wrong",
            _ => call.attached_deposit_yocto = 1,
        }
        rejected(
            admit_payment(
                &f.snapshot(&call),
                &f.quote,
                CredentialEvidence::default(),
                Some(&payment),
                |_, _, _| panic!("unauthorized verification"),
            )
            .unwrap(),
            DenialCode::Unauthorized,
        );
    }
    let call = f.context();
    let mut snapshot = f.snapshot(&call);
    snapshot.owner = None;
    rejected(
        admit_payment(
            &snapshot,
            &f.quote,
            CredentialEvidence::default(),
            Some(&payment),
            |_, _, _| panic!("unfunded verification"),
        )
        .unwrap(),
        DenialCode::Unauthorized,
    );
}
#[test]
fn exact_retry_survives_current_changes_and_keeps_original_evidence() {
    let mut f = Fixture::new();
    let reserved = f.reserve();
    let mut saved = reserved.payment;
    saved.credential = Some(CredentialRef {
        issuer_id: account("issuer.testnet"),
        credential_id: FixedBytes([12; 32]),
        revision: 2,
    });
    saved.state = PaymentState::Settled;
    saved.finalized_at_ns = U64String(NOW + 1);
    f.owner = reserved.actor;
    f.owner.policy.paused = true;
    f.owner.policy.revision += 1;
    f.owner
        .sessions
        .get_mut(&f.quote.invoice.session_id)
        .unwrap()
        .revoked = true;
    f.service.version += 1;
    f.service.invoice_key = FixedBytes([99; 32]);
    let before = f.owner.clone();
    let call = f.context();
    let mut snapshot = f.snapshot(&call);
    snapshot.now_ns = NOW + 1_000_000_000_000;
    snapshot.backing.runtime_balance_yocto = 0;
    let result = admit_payment(
        &snapshot,
        &f.quote,
        CredentialEvidence::default(),
        Some(&saved),
        |_, _, _| panic!("retry verification"),
    )
    .unwrap();
    assert_eq!(result, PaymentAdmission::Duplicate(saved));
    assert_eq!(before, f.owner);
}
#[test]
fn same_id_with_changed_invoice_conflicts_before_current_policy() {
    let mut f = Fixture::new();
    let saved = f.reserve().payment;
    f.quote.invoice.amount_yocto.0 += 1;
    f.owner.policy.paused = true;
    let call = f.context();
    rejected(
        admit_payment(
            &f.snapshot(&call),
            &f.quote,
            CredentialEvidence::default(),
            Some(&saved),
            |_, _, _| panic!("conflict verification"),
        )
        .unwrap(),
        DenialCode::PaymentIdConflict,
    );
}
#[test]
fn all_new_business_denials_leave_owner_and_aggregate_inputs_unchanged() {
    for variant in 0..5 {
        let mut f = Fixture::new();
        let expected = match variant {
            0 => {
                f.owner.policy.paused = true;
                DenialCode::Paused
            }
            1 => {
                f.owner
                    .blocked_services
                    .insert(f.service.service_id.clone());
                DenialCode::BlockedService
            }
            2 => {
                f.owner.ledger.available_yocto = U128String(0);
                DenialCode::InsufficientFunds
            }
            3 => {
                f.backing.runtime_balance_yocto -= 1;
                DenialCode::InsufficientBacking
            }
            _ => {
                f.owner.trusted_services.clear();
                DenialCode::UnknownService
            }
        };
        let before = f.owner.clone();
        let liabilities = AggregateLiabilities {
            available_yocto: f.backing.aggregate_available_yocto,
            storage_credit_yocto: f.backing.aggregate_storage_credit_yocto,
        };
        let call = f.context();
        rejected(
            admit_payment(
                &f.snapshot(&call),
                &f.quote,
                CredentialEvidence::default(),
                None,
                |_, _, _| true,
            )
            .unwrap(),
            expected,
        );
        assert_eq!(f.owner, before);
        assert_eq!(
            f.backing.aggregate_available_yocto,
            liabilities.available_yocto
        );
        assert_eq!(
            f.backing.aggregate_storage_credit_yocto,
            liabilities.storage_credit_yocto
        );
        assert_eq!(f.owner.usage.retained_payments, 0);
        assert_eq!(f.owner.usage.outstanding_transfers, 0);
    }
}
#[test]
fn successful_admission_reserves_from_persisted_usage_not_claimed_flags() {
    let mut f = Fixture::new();
    let first = f.reserve();
    assert_eq!(first.actor.ledger.available_yocto.0, 970_000);
    assert_eq!(first.actor.ledger.pending_payment_yocto.0, 30_000);
    assert_eq!(first.liabilities.available_yocto, 970_000);
    assert_eq!(first.actor.usage.dispatched_in_minute, 1);
    f.owner = first.actor;
    f.backing.aggregate_available_yocto = first.liabilities.available_yocto;
    f.owner.policy.daily_cap_yocto = U128String(50_000);
    f.quote.invoice.payment_id = FixedBytes([5; 32]);
    let call = f.context();
    rejected(
        admit_payment(
            &f.snapshot(&call),
            &f.quote,
            CredentialEvidence::default(),
            None,
            |_, _, _| true,
        )
        .unwrap(),
        DenialCode::DailyCap,
    );
}
#[test]
fn storage_bound_covers_payment_keys_index_and_new_day_with_largest_names() {
    let mut f = Fixture::new();
    let maximal = account(&"a".repeat(64));
    f.quote.invoice.core_account = maximal.clone();
    f.quote.invoice.owner_id = maximal.clone();
    f.quote.invoice.service_id = maximal.clone();
    f.quote.invoice.payout_account = maximal.clone();
    f.quote.invoice.profile_id = ProfileId::new("界".repeat(21)).unwrap();
    let credential = CredentialRef {
        issuer_id: maximal,
        credential_id: FixedBytes([1; 32]),
        revision: u32::MAX,
    };
    let bound = payment_storage_bound(&f.quote, Some(&credential));
    let record = PaymentRecord {
        invoice: f.quote.invoice.clone(),
        invoice_hash: FixedBytes([0; 32]),
        credential: Some(credential),
        dispatched_at_ns: U64String(NOW),
        dispatch_day: U64String(0),
        dispatch_minute: U64String(0),
        state: PaymentState::Pending,
        finalized_at_ns: U64String(0),
    };
    let key_bytes = (b"payments:v1".len() + 4 + 64 + 32) + (b"payment-ids:v1".len() + 4 + 64);
    let record_overhead = 2 * 40;
    let first_index = 4 + 32;
    let day_entry = 8 + 16;
    let serialized = borsh::to_vec(&record).unwrap().len() as u64;
    assert!(bound >= serialized + (key_bytes + record_overhead + first_index + day_entry) as u64);
    assert!(bound < serialized + 2048);
    assert!(payment_storage_bound(&f.quote, None) < bound);
}

#[test]
fn pretransfer_backing_includes_amount_already_removed_from_available() {
    use agenttrust_domain::payments::required_before_transfer;
    let f = Fixture::new();
    let state = f.reserve();
    let charged = AggregateLiabilities {
        available_yocto: state.liabilities.available_yocto,
        storage_credit_yocto: 90_000,
    };
    assert_eq!(
        required_before_transfer(20_000, 10_000, charged, 30_000),
        Some(1_120_000)
    );
    assert!(1_119_999 < required_before_transfer(20_000, 10_000, charged, 30_000).unwrap());
    assert_eq!(
        required_before_transfer(u128::MAX, 10_000, charged, 30_000),
        None
    );
}
#[test]
fn reconciliation_display_never_mutates_a_record_or_releases_a_reservation() {
    use agenttrust_domain::payments::{PaymentDisplayState as S, PaymentView};
    let f = Fixture::new();
    let state = f.reserve();
    let record = state.payment.clone();
    assert_eq!(
        PaymentView::new(record.clone(), NOW + 119_999_999_999).display_state,
        S::Pending
    );
    let late = PaymentView::new(record.clone(), NOW + 120_000_000_000);
    assert_eq!(late.display_state, S::NeedsReconciliation);
    assert_eq!(late.record, record);
    assert_eq!(state.actor.ledger.pending_payment_yocto.0, 30_000);
    for (stored, display) in [
        (PaymentState::Settled, S::Settled),
        (PaymentState::Failed, S::Failed),
    ] {
        let mut terminal = record.clone();
        terminal.state = stored;
        assert_eq!(
            PaymentView::new(terminal, NOW + 120_000_000_000).display_state,
            display
        );
    }
}
