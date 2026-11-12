//! Actual contract Rust methods against near-sdk's ordinary HashMap host.
//! This does not execute WASM, transactions, receipts, database operations or a chain.
use agenttrust_contract_memory::AgentTrustCore;
use agenttrust_domain::{
    accounting::PaymentState,
    codec::encode_invoice,
    types::{FixedBytes, InvoiceV1, ProfileId, SignedInvoiceV1, U64String, U128String},
    withdrawals::WithdrawalState,
};
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::{
    AccountId, CurveType, Gas, MockedBlockchain, NearToken, PromiseResult, PublicKey,
    RuntimeFeesConfig, env,
    mock::MockAction,
    serde_json::{self, Value},
    test_utils::{VMContextBuilder, get_created_receipts, get_logs},
    test_vm_config, testing_env,
};

const CORE: &str = "core.testnet";
const OWNER: &str = "owner.testnet";
const MERCHANT: &str = "audit.testnet";
const PAYOUT: &str = "seller.testnet";
const NOW: u64 = 1_800_000_000_000_000_000;
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const PRICE: u128 = NEAR / 10;

fn account(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn profile() -> ProfileId {
    ProfileId::new("audit".into()).unwrap()
}
fn public_key(byte: u8) -> PublicKey {
    PublicKey::from_parts(CurveType::ED25519, vec![byte; 32]).unwrap()
}
fn context(caller: &str, key: PublicKey, deposit: u128, now: u64) -> VMContextBuilder {
    let mut context = VMContextBuilder::new();
    context
        .current_account_id(account(CORE))
        .predecessor_account_id(account(caller))
        .signer_account_id(account(caller))
        .signer_account_pk(key)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(now)
        .prepaid_gas(Gas::from_tgas(300));
    context
}
fn fresh() {
    let mut ctx = context(CORE, public_key(1), 0, NOW);
    ctx.account_balance(NearToken::from_near(20))
        .storage_usage(0);
    env::set_blockchain_interface(MockedBlockchain::new(
        ctx.build(),
        test_vm_config(),
        RuntimeFeesConfig::test(),
        vec![],
        Default::default(),
        Default::default(),
        None,
    ));
    let core = AgentTrustCore::new("near:testnet".into(), U128String(NEAR));
    env::state_write(&core);
}
/// Every call reconstructs the real root and LookupMaps from serialized storage.
/// Values for context and promise results are supplied by this test, not a scheduler.
fn call<R>(
    caller: &str,
    key: PublicKey,
    deposit: u128,
    now: u64,
    results: Vec<PromiseResult>,
    f: impl FnOnce(&mut AgentTrustCore) -> R,
) -> R {
    let mut ctx = context(caller, key, deposit, now);
    ctx.account_balance(env::account_balance())
        .storage_usage(env::storage_usage());
    testing_env!(
        ctx.build(),
        test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
    let mut core: AgentTrustCore = env::state_read().expect("serialized root");
    f(&mut core)
}
fn owner<R>(f: impl FnOnce(&mut AgentTrustCore) -> R) -> R {
    call(OWNER, public_key(1), 1, NOW, vec![], f)
}
fn view<R>(f: impl FnOnce(&AgentTrustCore) -> R) -> R {
    let core: AgentTrustCore = env::state_read().expect("serialized root");
    f(&core)
}
fn owner_account() -> Value {
    view(|c| serde_json::to_value(c.get_account(account(OWNER)).unwrap()).unwrap())
}
fn money(value: &Value, name: &str) -> u128 {
    value[name].as_str().unwrap().parse().unwrap()
}
fn funded() {
    fresh();
    call(OWNER, public_key(1), 5 * NEAR, NOW, vec![], |c| {
        c.deposit(U128String(NEAR));
    });
}
fn configured() -> SigningKey {
    funded();
    let signing = SigningKey::from_bytes(&[7; 32]);
    call(MERCHANT, public_key(2), NEAR, NOW, vec![], |c| {
        c.deposit(U128String(NEAR));
    });
    call(MERCHANT, public_key(2), 1, NOW, vec![], |c| {
        c.set_service(
            None,
            account(PAYOUT),
            FixedBytes(signing.verifying_key().to_bytes()),
            FixedBytes([8; 32]),
            true,
        );
    });
    owner(|c| {
        c.set_profile(profile(), None, None);
    });
    owner(|c| {
        c.set_policy(1, U128String(2 * NEAR), 10, false);
    });
    owner(|c| {
        c.register_session(
            FixedBytes([3; 32]),
            public_key(3),
            profile(),
            1,
            U128String(NEAR),
            U64String(NOW + 1_000_000_000_000),
        );
    });
    owner(|c| {
        c.set_service_trust(account(MERCHANT), 1, vec![profile()], None, true);
    });
    signing
}
fn quote(signing: &SigningKey, id: u8) -> SignedInvoiceV1 {
    let policy_revision = view(|c| c.get_policy(account(OWNER)).unwrap().policy.revision);
    let invoice = InvoiceV1 {
        schema_version: 1,
        network: "near:testnet".into(),
        core_account: account(CORE),
        owner_id: account(OWNER),
        session_id: FixedBytes([3; 32]),
        payment_id: FixedBytes([id; 32]),
        policy_revision,
        profile_id: profile(),
        profile_revision: 1,
        service_id: account(MERCHANT),
        service_version: 1,
        payout_account: account(PAYOUT),
        endpoint_hash: FixedBytes([8; 32]),
        request_hash: FixedBytes([9; 32]),
        asset: "NEAR".into(),
        amount_yocto: U128String(PRICE),
        issued_at_ns: U64String(NOW),
        expires_at_ns: U64String(NOW + 120_000_000_000),
    };
    let signature = FixedBytes(signing.sign(&encode_invoice(&invoice)).to_bytes());
    SignedInvoiceV1 { invoice, signature }
}
fn pay(quote: SignedInvoiceV1) -> Value {
    call(OWNER, public_key(3), 0, NOW, vec![], |c| {
        serde_json::to_value(c.execute_payment(quote, None)).unwrap()
    })
}
fn callback(id: u8, result: PromiseResult, now: u64) -> agenttrust_domain::payments::PaymentView {
    call(CORE, public_key(1), 0, now, vec![result], |c| {
        c.on_payment_result(account(OWNER), FixedBytes([id; 32]))
    })
}
fn assert_actions(receiver: &str, method: &str, id_field: &str, id: u8, amount: u128) {
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 2);
    assert_eq!(receipts[0].receiver_id, account(receiver));
    assert!(receipts[0].receipt_indices.is_empty());
    assert_eq!(receipts[0].actions.len(), 1);
    let transfer_index = match &receipts[0].actions[0] {
        MockAction::Transfer {
            receipt_index,
            deposit,
        } => {
            assert_eq!(deposit.as_yoctonear(), amount);
            *receipt_index
        }
        action => panic!("unexpected transfer action: {action:?}"),
    };
    assert_eq!(receipts[1].receiver_id, account(CORE));
    assert_eq!(receipts[1].receipt_indices, vec![transfer_index]);
    assert_eq!(receipts[1].actions.len(), 1);
    match &receipts[1].actions[0] {
        MockAction::FunctionCallWeight {
            method_name,
            args,
            attached_deposit,
            prepaid_gas,
            ..
        } => {
            assert_eq!(method_name, method.as_bytes());
            assert_eq!(attached_deposit.as_yoctonear(), 0);
            assert_eq!(*prepaid_gas, Gas::from_tgas(30));
            let args: Value = serde_json::from_slice(args).unwrap();
            assert_eq!(args["owner_id"], OWNER);
            assert_eq!(
                args[id_field],
                serde_json::to_value(FixedBytes([id; 32])).unwrap()
            );
        }
        action => panic!("unexpected callback action: {action:?}"),
    }
}

#[test]
fn deposit_charges_measured_storage_and_survives_serialized_reload() {
    fresh();
    let before = env::storage_usage();
    call(OWNER, public_key(1), 5 * NEAR, NOW, vec![], |c| {
        c.deposit(U128String(NEAR));
    });
    let growth = env::storage_usage() - before;
    assert!(growth > 0);
    let account = owner_account();
    assert_eq!(money(&account, "available_yocto"), 4 * NEAR);
    assert_eq!(money(&account, "storage_charged_bytes"), u128::from(growth));
    assert_eq!(
        money(&account, "storage_credit_yocto"),
        NEAR - u128::from(growth) * env::storage_byte_cost().as_yoctonear()
    );
    assert_eq!(money(&account["vault"], "total_available_yocto"), 4 * NEAR);
    assert!(get_created_receipts().is_empty());
}

#[test]
fn signed_dispatch_prices_actual_storage_and_records_exact_promise_actions() {
    let signing = configured();
    let before = owner_account();
    let storage_before = env::storage_usage();
    let balance_before = env::account_balance().as_yoctonear();
    let result = pay(quote(&signing, 4));
    assert_eq!(result["kind"], "payment");
    assert_eq!(result["duplicate"], false);
    assert_eq!(result["payment"]["state"], "pending");
    assert_actions(PAYOUT, "on_payment_result", "payment_id", 4, PRICE);
    let after = owner_account();
    assert_eq!(
        money(&after, "available_yocto"),
        money(&before, "available_yocto") - PRICE
    );
    assert_eq!(money(&after, "pending_payment_yocto"), PRICE);
    assert_eq!(after["usage"]["outstanding_transfers"], 1);
    assert_eq!(after["usage"]["retained_payments"], 1);
    let growth = env::storage_usage() - storage_before;
    assert!(growth > 0);
    assert_eq!(
        money(&before, "storage_credit_yocto") - money(&after, "storage_credit_yocto"),
        u128::from(growth) * env::storage_byte_cost().as_yoctonear()
    );
    assert_eq!(
        env::account_balance().as_yoctonear(),
        balance_before - PRICE
    );
    assert_eq!(
        view(|c| c
            .get_payment(account(OWNER), FixedBytes([4; 32]))
            .unwrap()
            .record
            .state),
        PaymentState::Pending
    );
}

#[test]
fn exact_retry_uses_persisted_record_without_second_transfer_or_charge() {
    let signing = configured();
    let quote = quote(&signing, 5);
    pay(quote.clone());
    let before = owner_account();
    let storage_before = env::storage_usage();
    let balance_before = env::account_balance();
    let result = pay(quote);
    assert_eq!(result["duplicate"], true);
    assert!(get_created_receipts().is_empty());
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_usage(), storage_before);
    assert_eq!(env::account_balance(), balance_before);
}

#[test]
fn invalid_signature_is_rejected_by_host_crypto_without_state_change() {
    let signing = configured();
    let mut quote = quote(&signing, 6);
    quote.signature.0[0] ^= 1;
    let before = owner_account();
    let root_before = env::storage_read(b"STATE");
    let storage_before = env::storage_usage();
    let result = pay(quote);
    assert_eq!(result["kind"], "rejected");
    assert_eq!(result["decision"]["code"], "INVALID_INVOICE");
    assert!(get_created_receipts().is_empty());
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_read(b"STATE"), root_before);
    assert_eq!(env::storage_usage(), storage_before);
    assert!(view(|c| c
        .get_payment(account(OWNER), FixedBytes([6; 32]))
        .is_none()));
}

#[test]
fn successful_callback_updates_persisted_accounting_without_storage_growth() {
    let signing = configured();
    pay(quote(&signing, 7));
    let before = owner_account();
    let storage_before = env::storage_usage();
    let result = callback(7, PromiseResult::Successful(vec![]), NOW + 1);
    assert_eq!(result.record.state, PaymentState::Settled);
    let after = owner_account();
    assert_eq!(
        money(&after, "available_yocto"),
        money(&before, "available_yocto")
    );
    assert_eq!(money(&after, "pending_payment_yocto"), 0);
    assert_eq!(after["usage"]["outstanding_transfers"], 0);
    assert_eq!(money(&after["usage"], "settled_current_day_yocto"), PRICE);
    assert_eq!(env::storage_usage(), storage_before);
    assert!(get_created_receipts().is_empty());
    assert!(get_logs().iter().any(|l| l.contains("payment_finalized")));
}

#[test]
fn failed_callback_restores_available_after_policy_pause_without_scheduling_refund() {
    let signing = configured();
    let available_before = money(&owner_account(), "available_yocto");
    pay(quote(&signing, 8));
    owner(|c| {
        let revision = c.get_policy(account(OWNER)).unwrap().policy.revision;
        c.set_policy(revision, U128String(0), 0, true);
    });
    let storage_before = env::storage_usage();
    let result = callback(8, PromiseResult::Failed, NOW + 1);
    assert_eq!(result.record.state, PaymentState::Failed);
    assert_eq!(money(&owner_account(), "available_yocto"), available_before);
    assert_eq!(money(&owner_account(), "pending_payment_yocto"), 0);
    assert_eq!(env::storage_usage(), storage_before);
    assert!(get_created_receipts().is_empty());
}

#[test]
fn duplicate_terminal_callback_ignores_conflicting_result_without_recredit() {
    let signing = configured();
    pay(quote(&signing, 9));
    callback(9, PromiseResult::Successful(vec![]), NOW + 1);
    let before = owner_account();
    let storage_before = env::storage_usage();
    let result = callback(9, PromiseResult::Failed, NOW + 1);
    assert_eq!(result.record.state, PaymentState::Settled);
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_usage(), storage_before);
    assert!(get_created_receipts().is_empty());
    assert!(get_logs().is_empty());
}

#[test]
#[should_panic(expected = "UNAUTHORIZED")]
fn callback_rejects_external_predecessor() {
    let signing = configured();
    pay(quote(&signing, 10));
    call(
        OWNER,
        public_key(1),
        0,
        NOW,
        vec![PromiseResult::Failed],
        |c| {
            c.on_payment_result(account(OWNER), FixedBytes([10; 32]));
        },
    );
}

#[test]
#[should_panic(expected = "UNAUTHORIZED")]
fn callback_requires_exactly_one_promise_result() {
    let signing = configured();
    pay(quote(&signing, 11));
    call(
        CORE,
        public_key(1),
        0,
        NOW,
        vec![PromiseResult::Failed, PromiseResult::Failed],
        |c| {
            c.on_payment_result(account(OWNER), FixedBytes([11; 32]));
        },
    );
}

#[test]
#[should_panic(expected = "UNEXPECTED_TRANSFER_RESULT")]
fn callback_rejects_nonempty_success_payload() {
    let signing = configured();
    pay(quote(&signing, 12));
    callback(12, PromiseResult::Successful(vec![1]), NOW);
}

#[test]
fn withdrawal_records_actions_and_failed_callback_restores_available_once() {
    funded();
    let before = money(&owner_account(), "available_yocto");
    let withdrawal = owner(|c| c.withdraw_available(FixedBytes([13; 32]), U128String(PRICE)));
    assert_eq!(withdrawal.record.state, WithdrawalState::Pending);
    assert_actions(OWNER, "on_withdrawal_result", "withdrawal_id", 13, PRICE);
    let charged = owner_account();
    owner(|c| {
        c.withdraw_available(FixedBytes([13; 32]), U128String(PRICE));
    });
    assert!(get_created_receipts().is_empty());
    assert_eq!(money(&owner_account(), "available_yocto"), before - PRICE);
    assert_eq!(
        money(&owner_account(), "storage_credit_yocto"),
        money(&charged, "storage_credit_yocto")
    );
    let storage_before = env::storage_usage();
    for _ in 0..2 {
        let result = call(
            CORE,
            public_key(1),
            0,
            NOW,
            vec![PromiseResult::Failed],
            |c| c.on_withdrawal_result(account(OWNER), FixedBytes([13; 32])),
        );
        assert_eq!(result.record.state, WithdrawalState::Failed);
        assert_eq!(money(&owner_account(), "available_yocto"), before);
        assert_eq!(env::storage_usage(), storage_before);
        assert!(get_created_receipts().is_empty());
    }
}

#[test]
fn successful_withdrawal_leaves_available_reserved_and_callback_storage_fixed() {
    funded();
    let before = money(&owner_account(), "available_yocto");
    owner(|c| {
        c.withdraw_available(FixedBytes([14; 32]), U128String(PRICE));
    });
    let storage_before = env::storage_usage();
    let result = call(
        CORE,
        public_key(1),
        0,
        NOW,
        vec![PromiseResult::Successful(vec![])],
        |c| c.on_withdrawal_result(account(OWNER), FixedBytes([14; 32])),
    );
    assert_eq!(result.record.state, WithdrawalState::Succeeded);
    assert_eq!(money(&owner_account(), "available_yocto"), before - PRICE);
    assert_eq!(owner_account()["usage"]["outstanding_transfers"], 0);
    assert_eq!(env::storage_usage(), storage_before);
    assert!(get_created_receipts().is_empty());
}

#[test]
#[should_panic(expected = "STORAGE_CREDIT")]
fn actual_growth_charge_aborts_without_enough_storage_credit() {
    // This asserts the adapter aborts, not that the mock rolls provisional writes back.
    fresh();
    call(OWNER, public_key(1), NEAR, NOW, vec![], |c| {
        c.deposit(U128String(1));
    });
}

#[test]
fn host_signer_key_must_match_registered_worker_before_dispatch() {
    let signing = configured();
    let quote = quote(&signing, 15);
    let before = owner_account();
    let storage_before = env::storage_usage();
    let result = call(OWNER, public_key(2), 0, NOW, vec![], |c| {
        serde_json::to_value(c.execute_payment(quote, None)).unwrap()
    });
    assert_eq!(result["kind"], "rejected");
    assert_eq!(result["decision"]["code"], "UNAUTHORIZED");
    assert!(get_created_receipts().is_empty());
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_usage(), storage_before);
}

#[test]
fn host_backing_shortfall_rejects_before_reserving_or_scheduling() {
    let signing = configured();
    let quote = quote(&signing, 16);
    let mut ctx = context(OWNER, public_key(3), 0, NOW);
    ctx.account_balance(NearToken::from_yoctonear(PRICE))
        .storage_usage(env::storage_usage());
    // A test-supplied low host balance; this does not simulate a real refund.
    testing_env!(ctx.build());
    let before = owner_account();
    let root_before = env::storage_read(b"STATE");
    let storage_before = env::storage_usage();
    let mut core: AgentTrustCore = env::state_read().unwrap();
    let result = serde_json::to_value(core.execute_payment(quote, None)).unwrap();
    drop(core);
    assert_eq!(result["kind"], "rejected");
    assert_eq!(result["decision"]["code"], "INSUFFICIENT_BACKING");
    assert!(get_created_receipts().is_empty());
    assert_eq!(owner_account(), before);
    assert_eq!(env::storage_read(b"STATE"), root_before);
    assert_eq!(env::storage_usage(), storage_before);
}

mod registry_limits;
