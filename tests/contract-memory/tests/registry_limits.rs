//! Supplemental adapter coverage. Context and outcomes remain test-supplied.
use super::*;
use agenttrust_domain::{
    owner::CapabilityRequirement,
    registry::{Credential, CredentialAssertion, CredentialRef},
};

const ISSUER: &str = "issuer.testnet";
const OTHER_ISSUER: &str = "other-issuer.testnet";
const OTHER_SERVICE: &str = "other-service.testnet";
const SUITE_HASH: u8 = 44;

fn fund_storage(caller: &str) {
    call(caller, public_key(6), NEAR, NOW, vec![], |c| {
        c.deposit(U128String(NEAR));
    });
}
fn credential_setup() -> SigningKey {
    let signing = configured();
    fund_storage(ISSUER);
    owner(|c| {
        c.set_profile(
            profile(),
            Some(1),
            Some(CapabilityRequirement {
                capability_namespace: "invoice.audit".into(),
                capability_version: 1,
                conformance_suite_version: 1,
                conformance_suite_hash: FixedBytes([SUITE_HASH; 32]),
                accepted_issuers: vec![account(ISSUER)],
            }),
        );
    });
    owner(|c| {
        c.register_session(
            FixedBytes([4; 32]),
            public_key(4),
            profile(),
            2,
            U128String(NEAR),
            U64String(NOW + 1_000_000_000_000),
        );
    });
    signing
}
fn assertion(service_id: &str) -> CredentialAssertion {
    CredentialAssertion {
        service_id: account(service_id),
        service_version: 1,
        capability_namespace: "invoice.audit".into(),
        capability_version: 1,
        conformance_suite_version: 1,
        conformance_suite_hash: FixedBytes([SUITE_HASH; 32]),
        evidence_manifest_hash: FixedBytes([45; 32]),
        issued_at_ns: U64String(NOW),
        expires_at_ns: U64String(NOW + 1_000_000_000_000),
    }
}
fn issue(
    caller: &str,
    id: u8,
    expected: Option<u32>,
    assertion: CredentialAssertion,
) -> Credential {
    call(caller, public_key(6), 1, NOW, vec![], |c| {
        c.issue_credential(FixedBytes([id; 32]), expected, assertion)
    })
}
fn resign(mut quote: SignedInvoiceV1, signing: &SigningKey) -> SignedInvoiceV1 {
    quote.signature = FixedBytes(signing.sign(&encode_invoice(&quote.invoice)).to_bytes());
    quote
}
fn protected_quote(signing: &SigningKey, id: u8) -> SignedInvoiceV1 {
    let mut quote = quote(signing, id);
    quote.invoice.session_id = FixedBytes([4; 32]);
    quote.invoice.profile_revision = 2;
    resign(quote, signing)
}
fn execute(quote: SignedInvoiceV1, key: u8, credential: Option<CredentialRef>) -> Value {
    call(OWNER, public_key(key), 0, NOW, vec![], |c| {
        serde_json::to_value(c.execute_payment(quote, credential)).unwrap()
    })
}
fn assert_unchanged_denial(
    quote: SignedInvoiceV1,
    key: u8,
    credential: Option<CredentialRef>,
    kind: &str,
    code: &str,
) {
    let before = owner_account();
    let root_before = env::storage_read(b"STATE");
    let storage_before = env::storage_usage();
    let payment_id = quote.invoice.payment_id;
    let result = execute(quote, key, credential);
    assert_eq!(result["kind"], "rejected");
    assert_eq!(result["decision"]["kind"], kind);
    assert_eq!(result["decision"]["code"], code);
    assert!(get_created_receipts().is_empty());
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_read(b"STATE"), root_before);
    assert_eq!(env::storage_usage(), storage_before);
    assert!(view(|c| c
        .get_payment(account(OWNER), payment_id)
        .is_none()));
}
fn issuer_account(caller: &str) -> Value {
    view(|c| serde_json::to_value(c.get_account(account(caller)).unwrap()).unwrap())
}
fn sibling_session() {
    owner(|c| {
        c.register_session(
            FixedBytes([4; 32]),
            public_key(4),
            profile(),
            1,
            U128String(NEAR),
            U64String(NOW + 1_000_000_000_000),
        );
    });
}
fn sibling_quote(signing: &SigningKey, id: u8, amount: u128) -> SignedInvoiceV1 {
    let mut quote = quote(signing, id);
    quote.invoice.session_id = FixedBytes([4; 32]);
    quote.invoice.amount_yocto = U128String(amount);
    resign(quote, signing)
}

#[test]
fn credential_issue_renew_revoke_charge_issuer_and_pin_references() {
    let signing = credential_setup();
    let issuer_before = issuer_account(ISSUER);
    let buyer_before = owner_account();
    let storage_before = env::storage_usage();
    let issued = issue(ISSUER, 20, None, assertion(MERCHANT));
    let growth = env::storage_usage() - storage_before;
    assert!(growth > 0);
    assert_eq!(issued.revision, 1);
    assert!(!issued.revoked);
    assert_eq!(
        view(|c| c.get_credential(account(ISSUER), FixedBytes([20; 32]))),
        Some(issued.clone())
    );
    assert_eq!(
        money(&issuer_before, "storage_credit_yocto")
            - money(&issuer_account(ISSUER), "storage_credit_yocto"),
        u128::from(growth) * env::storage_byte_cost().as_yoctonear()
    );
    assert_eq!(
        money(&owner_account(), "storage_credit_yocto"),
        money(&buyer_before, "storage_credit_yocto")
    );
    assert_eq!(
        money(&owner_account(), "available_yocto"),
        money(&buyer_before, "available_yocto")
    );
    assert_eq!(owner_account()["usage"], buyer_before["usage"]);
    let reference = issued.reference();
    let result = execute(protected_quote(&signing, 21), 4, Some(reference.clone()));
    assert_eq!(result["kind"], "payment");
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 21, PRICE);
    assert_eq!(
        view(|c| c
            .get_payment(account(OWNER), FixedBytes([21; 32]))
            .unwrap()
            .record
            .credential),
        Some(reference.clone())
    );

    let credit_before = money(&issuer_account(ISSUER), "storage_credit_yocto");
    let storage_before = env::storage_usage();
    for _ in 0..2 {
        let revoked = call(ISSUER, public_key(6), 1, NOW, vec![], |c| {
            c.revoke_credential(FixedBytes([20; 32]))
        });
        assert!(revoked.revoked);
        assert_eq!(revoked.reference(), reference);
        assert_eq!(env::storage_usage(), storage_before);
        assert_eq!(
            money(&issuer_account(ISSUER), "storage_credit_yocto"),
            credit_before
        );
        assert!(get_created_receipts().is_empty());
    }
    assert_unchanged_denial(
        protected_quote(&signing, 22),
        4,
        Some(reference.clone()),
        "require_validation",
        "REVOKED",
    );
    let renewed = issue(ISSUER, 20, Some(1), assertion(MERCHANT));
    assert_eq!(renewed.revision, 2);
    assert!(!renewed.revoked);
    assert_eq!(env::storage_usage(), storage_before);
    assert_eq!(
        money(&issuer_account(ISSUER), "storage_credit_yocto"),
        credit_before
    );
    assert_eq!(
        view(|c| c.get_credential(account(ISSUER), FixedBytes([20; 32]))),
        Some(renewed.clone())
    );
    assert_unchanged_denial(
        protected_quote(&signing, 23),
        4,
        Some(reference),
        "require_validation",
        "REVISION_CHANGED",
    );
    let result = execute(protected_quote(&signing, 24), 4, Some(renewed.reference()));
    assert_eq!(result["kind"], "payment");
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 24, PRICE);
}

#[test]
fn issuer_namespaces_keep_same_id_records_and_revocations_separate() {
    let signing = credential_setup();
    fund_storage(OTHER_ISSUER);
    let accepted = issue(ISSUER, 25, None, assertion(MERCHANT));
    let mut other_assertion = assertion(MERCHANT);
    other_assertion.conformance_suite_hash = FixedBytes([99; 32]);
    let other = issue(OTHER_ISSUER, 25, None, other_assertion);
    assert_ne!(accepted.reference(), other.reference());
    assert_eq!(
        view(|c| c.get_credential(account(ISSUER), FixedBytes([25; 32]))),
        Some(accepted.clone())
    );
    assert_eq!(
        view(|c| c.get_credential(account(OTHER_ISSUER), FixedBytes([25; 32]))),
        Some(other.clone())
    );
    assert_unchanged_denial(
        protected_quote(&signing, 26),
        4,
        Some(other.reference()),
        "require_validation",
        "UNACCEPTED_ISSUER",
    );
    call(OTHER_ISSUER, public_key(6), 1, NOW, vec![], |c| {
        c.revoke_credential(FixedBytes([25; 32]));
    });
    assert_eq!(
        view(|c| c.get_credential(account(ISSUER), FixedBytes([25; 32]))),
        Some(accepted.clone())
    );
    assert!(view(|c| c
        .get_credential(account(OTHER_ISSUER), FixedBytes([25; 32]))
        .unwrap()
        .revoked));
    let result = execute(protected_quote(&signing, 27), 4, Some(accepted.reference()));
    assert_eq!(result["kind"], "payment");
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 27, PRICE);
}

#[test]
fn credential_storage_lookup_enforces_exact_subject_suite_and_reference() {
    let signing = credential_setup();
    fund_storage(OTHER_SERVICE);
    call(OTHER_SERVICE, public_key(6), 1, NOW, vec![], |c| {
        c.set_service(
            None,
            account(PAYOUT),
            FixedBytes(signing.verifying_key().to_bytes()),
            FixedBytes([8; 32]),
            true,
        );
    });
    let subject = issue(ISSUER, 30, None, assertion(OTHER_SERVICE));
    let mut wrong_hash = assertion(MERCHANT);
    wrong_hash.conformance_suite_hash = FixedBytes([99; 32]);
    let hash = issue(ISSUER, 31, None, wrong_hash);
    let mut wrong_version = assertion(MERCHANT);
    wrong_version.conformance_suite_version = 2;
    let version = issue(ISSUER, 32, None, wrong_version);
    let missing = CredentialRef {
        issuer_id: account(ISSUER),
        credential_id: FixedBytes([99; 32]),
        revision: 1,
    };
    for (id, reference, code) in [
        (33, subject.reference(), "WRONG_SUBJECT"),
        (34, hash.reference(), "WRONG_SUITE"),
        (35, version.reference(), "WRONG_SUITE"),
        (36, missing, "MISSING"),
    ] {
        assert_unchanged_denial(
            protected_quote(&signing, id),
            4,
            Some(reference),
            "require_validation",
            code,
        );
    }
    assert_eq!(owner_account()["usage"]["retained_payments"], 0);

    // A registry version change and new owner trust must not silently retarget
    // an existing credential from the old service identity to the new one.
    let old_subject = issue(ISSUER, 37, None, assertion(MERCHANT));
    call(MERCHANT, public_key(2), 1, NOW, vec![], |c| {
        c.set_service(
            Some(1),
            account(PAYOUT),
            FixedBytes(signing.verifying_key().to_bytes()),
            FixedBytes([8; 32]),
            true,
        );
    });
    owner(|c| {
        c.set_service_trust(account(MERCHANT), 2, vec![profile()], None, true);
    });
    let mut updated_quote = protected_quote(&signing, 38);
    updated_quote.invoice.service_version = 2;
    let updated_quote = resign(updated_quote, &signing);
    assert_unchanged_denial(
        updated_quote.clone(),
        4,
        Some(old_subject.reference()),
        "require_validation",
        "WRONG_SUBJECT",
    );
    assert_eq!(
        view(|c| c
            .get_credential(account(ISSUER), FixedBytes([37; 32]))
            .unwrap()
            .assertion
            .service_version),
        1
    );
    let mut updated_assertion = assertion(MERCHANT);
    updated_assertion.service_version = 2;
    let reissued = issue(ISSUER, 37, Some(1), updated_assertion);
    let result = execute(updated_quote, 4, Some(reissued.reference()));
    assert_eq!(result["kind"], "payment");
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 38, PRICE);
    assert_eq!(
        view(|c| c
            .get_payment(account(OWNER), FixedBytes([38; 32]))
            .unwrap()
            .record
            .credential),
        Some(reissued.reference())
    );
}

#[test]
fn identity_rotation_requires_current_invoice_and_new_owner_trust() {
    let original = configured();
    let old_quote = quote(&original, 40);
    let rotated = SigningKey::from_bytes(&[8; 32]);
    call(MERCHANT, public_key(2), 1, NOW, vec![], |c| {
        c.set_service(
            Some(1),
            account("new-seller.testnet"),
            FixedBytes(rotated.verifying_key().to_bytes()),
            FixedBytes([9; 32]),
            true,
        );
    });
    assert_eq!(
        view(|c| c.get_service(account(MERCHANT)).unwrap().version),
        2
    );
    assert_unchanged_denial(old_quote, 3, None, "deny", "IDENTITY_CHANGED");
    let current_quote = |id| {
        let mut value = quote(&rotated, id);
        value.invoice.service_version = 2;
        value.invoice.payout_account = account("new-seller.testnet");
        value.invoice.endpoint_hash = FixedBytes([9; 32]);
        resign(value, &rotated)
    };
    assert_unchanged_denial(current_quote(41), 3, None, "deny", "IDENTITY_CHANGED");
    owner(|c| {
        c.set_service_trust(account(MERCHANT), 2, vec![profile()], None, true);
    });
    let trusted = view(|c| c.get_policy(account(OWNER)).unwrap().trusted_services);
    assert_eq!(trusted[0].service_version, 2);
    assert_eq!(
        trusted[0].invoice_key,
        FixedBytes(rotated.verifying_key().to_bytes())
    );
    let result = pay(current_quote(42));
    assert_eq!(result["kind"], "payment");
    assert_actions(
        "new-seller.testnet",
        "on_payment_result",
        "payment_id",
        42,
        PRICE,
    );
}

#[test]
fn deactivated_trust_blocks_new_dispatch_but_keeps_exact_retry_observable() {
    let signing = configured();
    let dispatched = quote(&signing, 43);
    assert_eq!(pay(dispatched.clone())["kind"], "payment");
    owner(|c| {
        c.set_service_trust(account(MERCHANT), 1, vec![profile()], None, false);
    });
    assert!(!view(|c| c
        .get_policy(account(OWNER))
        .unwrap()
        .trusted_services[0]
        .active));
    let before = owner_account();
    let retry = pay(dispatched);
    assert_eq!(retry["duplicate"], true);
    assert_eq!(retry["payment"]["state"], "pending");
    assert!(get_created_receipts().is_empty());
    assert_eq!(owner_account(), before);
    assert_unchanged_denial(quote(&signing, 44), 3, None, "deny", "UNKNOWN_SERVICE");
}

#[test]
fn preview_is_read_only_under_host_view_mode_for_allow_deny_and_validation() {
    let signing = credential_setup();
    let credential = issue(ISSUER, 45, None, assertion(MERCHANT));
    let valid = protected_quote(&signing, 46);
    let mut invalid = valid.clone();
    invalid.signature.0[0] ^= 1;
    let mut ctx = context("unrelated.testnet", public_key(99), 0, NOW);
    ctx.account_balance(env::account_balance())
        .storage_usage(env::storage_usage())
        .is_view(true);
    testing_env!(ctx.build());
    assert!(ctx.build().is_view());
    let before = owner_account();
    let root_before = env::storage_read(b"STATE");
    let storage_before = env::storage_usage();
    let records_before = view(|c| {
        (
            c.get_service(account(MERCHANT)),
            c.get_credential(account(ISSUER), FixedBytes([45; 32])),
        )
    });
    let values = view(|c| {
        [
            c.preview_payment(valid.clone(), Some(credential.reference())),
            c.preview_payment(invalid, Some(credential.reference())),
            c.preview_payment(valid, None),
        ]
    });
    let json: Value = serde_json::to_value(values).unwrap();
    assert_eq!(json[0]["decision"]["kind"], "allow");
    assert_eq!(json[1]["decision"]["code"], "INVALID_INVOICE");
    assert_eq!(json[2]["decision"]["code"], "MISSING");
    for value in json.as_array().unwrap() {
        assert_eq!(value["authorization"], "not_proven_by_view");
    }
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_read(b"STATE"), root_before);
    assert_eq!(env::storage_usage(), storage_before);
    assert_eq!(
        view(|c| (
            c.get_service(account(MERCHANT)),
            c.get_credential(account(ISSUER), FixedBytes([45; 32]))
        )),
        records_before
    );
    assert!(view(|c| c
        .list_recent_payments(account(OWNER), None, 20)
        .items
        .is_empty()));
    assert!(get_created_receipts().is_empty());
    assert!(get_logs().is_empty());
}

#[test]
fn eight_shared_pending_transfers_across_sessions_and_withdrawal_deny_ninth() {
    let signing = configured();
    sibling_session();
    for id in 50..57 {
        let result = if id % 2 == 0 {
            pay(quote(&signing, id))
        } else {
            execute(sibling_quote(&signing, id, PRICE), 4, None)
        };
        assert_eq!(result["kind"], "payment");
        assert_actions(PAYOUT, "on_payment_result", "payment_id", id, PRICE);
        assert_eq!(owner_account()["usage"]["outstanding_transfers"], id - 49);
    }
    owner(|c| {
        c.withdraw_available(FixedBytes([57; 32]), U128String(PRICE));
    });
    assert_actions(OWNER, "on_withdrawal_result", "withdrawal_id", 57, PRICE);
    let before = owner_account();
    assert_eq!(before["usage"]["outstanding_transfers"], 8);
    assert_eq!(before["usage"]["retained_payments"], 7);
    assert_eq!(money(&before, "pending_payment_yocto"), 7 * PRICE);
    assert_eq!(money(&before, "available_yocto"), 4 * NEAR - 8 * PRICE);
    assert_unchanged_denial(
        sibling_quote(&signing, 58, PRICE),
        4,
        None,
        "deny",
        "CAPACITY",
    );
    let recent = view(|c| c.list_recent_payments(account(OWNER), None, 20).items);
    assert_eq!(recent.len(), 7);
    assert!(
        recent
            .iter()
            .all(|p| p.record.state == PaymentState::Pending)
    );
}

#[test]
fn purchase_cap_accepts_exact_amount_and_rejects_one_yocto_more() {
    let signing = configured();
    let mut excessive = quote(&signing, 60);
    excessive.invoice.amount_yocto = U128String(NEAR + 1);
    assert_unchanged_denial(resign(excessive, &signing), 3, None, "deny", "PURCHASE_CAP");
    let mut exact = quote(&signing, 61);
    exact.invoice.amount_yocto = U128String(NEAR);
    assert_eq!(pay(resign(exact, &signing))["kind"], "payment");
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 61, NEAR);
    assert_eq!(money(&owner_account(), "pending_payment_yocto"), NEAR);
}

#[test]
fn daily_cap_combines_sibling_pending_and_settled_amounts_at_exact_boundary() {
    let signing = configured();
    sibling_session();
    owner(|c| {
        let revision = c.get_policy(account(OWNER)).unwrap().policy.revision;
        c.set_policy(revision, U128String(2 * PRICE), 10, false);
    });
    assert_eq!(pay(quote(&signing, 62))["kind"], "payment");
    assert_unchanged_denial(
        sibling_quote(&signing, 63, PRICE + 1),
        4,
        None,
        "deny",
        "DAILY_CAP",
    );
    assert_eq!(
        execute(sibling_quote(&signing, 64, PRICE), 4, None)["kind"],
        "payment"
    );
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 64, PRICE);
    assert_eq!(money(&owner_account(), "pending_payment_yocto"), 2 * PRICE);
    callback(62, PromiseResult::Successful(vec![]), NOW);
    assert_eq!(money(&owner_account(), "pending_payment_yocto"), PRICE);
    assert_eq!(
        money(&owner_account()["usage"], "settled_current_day_yocto"),
        PRICE
    );
    assert_unchanged_denial(sibling_quote(&signing, 65, 1), 4, None, "deny", "DAILY_CAP");
}
