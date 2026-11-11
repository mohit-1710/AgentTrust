use agenttrust_domain::{
    accounting::{AggregateLiabilities, charge_actor_storage, credit_deposit},
    authority::{AuthorityError, CallContext, funding_actor},
    owner::ActorState,
    types::{AccountId, U64String, U128String},
};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const BYTE_COST: u128 = 10_000_000_000_000_000_000;
fn actor(name: &str) -> ActorState {
    ActorState::new(name.parse().unwrap())
}
fn liabilities(actor: &ActorState) -> AggregateLiabilities {
    AggregateLiabilities {
        available_yocto: actor.ledger.available_yocto.0,
        storage_credit_yocto: actor.ledger.storage_credit_yocto.0,
    }
}

#[test]
fn accounting_funding_requires_direct_positive_deposit_and_derives_actor() {
    let core: AccountId = "core.testnet".parse().unwrap();
    let owner: AccountId = "owner.testnet".parse().unwrap();
    let relay: AccountId = "relay.testnet".parse().unwrap();
    let mut context = CallContext {
        current_account: &core,
        predecessor: &owner,
        signer: &owner,
        signer_public_key: "ed25519:validated-at-native-boundary",
        attached_deposit_yocto: NEAR,
    };
    assert_eq!(funding_actor(&context), Ok(owner.clone()));
    context.predecessor = &relay;
    assert_eq!(funding_actor(&context), Err(AuthorityError::Unauthorized));
    context.predecessor = &owner;
    context.attached_deposit_yocto = 0;
    assert_eq!(funding_actor(&context), Err(AuthorityError::InvalidDeposit));
}

#[test]
fn accounting_initial_deposit_splits_before_priced_record_creation() {
    let initial = actor("owner.testnet");
    let split = credit_deposit(&initial, AggregateLiabilities::default(), NEAR, NEAR / 10).unwrap();
    assert_eq!(split.actor.ledger.available_yocto.0, 9 * NEAR / 10);
    assert_eq!(split.actor.ledger.storage_credit_yocto.0, NEAR / 10);
    let charged = charge_actor_storage(&split.actor, split.liabilities, 321, BYTE_COST).unwrap();
    let storage_cost = 321 * BYTE_COST;
    assert_eq!(charged.actor.ledger.available_yocto.0, 9 * NEAR / 10);
    assert_eq!(
        charged.actor.ledger.storage_credit_yocto.0,
        NEAR / 10 - storage_cost
    );
    assert_eq!(charged.actor.ledger.storage_charged_bytes.0, 321);
    assert_eq!(charged.actor.ledger.pending_payment_yocto.0, 0);
    assert_eq!(charged.liabilities, liabilities(&charged.actor));
    assert_eq!(
        charged.liabilities.available_yocto
            + charged.liabilities.storage_credit_yocto
            + storage_cost,
        NEAR
    );
    assert_eq!(charged.actor.policy.revision, 0);
    assert!(charged.actor.policy.paused);
    assert_eq!(charged.actor.policy.daily_cap_yocto.0, 0);
    assert_eq!(charged.actor.policy.max_dispatches_per_minute, 0);
    assert_eq!(initial, actor("owner.testnet"));
}

#[test]
fn accounting_rejects_zero_and_overallocated_deposits_without_mutation() {
    let initial = actor("owner.testnet");
    let totals = AggregateLiabilities::default();
    for (attached, storage) in [(0, 0), (0, 1), (10, 11)] {
        assert_eq!(
            credit_deposit(&initial, totals, attached, storage),
            Err(AuthorityError::InvalidDeposit)
        );
        assert_eq!(initial, actor("owner.testnet"));
        assert_eq!(totals, AggregateLiabilities::default());
    }
}

#[test]
fn accounting_initial_record_cannot_spend_principal_for_storage() {
    let initial = actor("owner.testnet");
    let split = credit_deposit(
        &initial,
        AggregateLiabilities::default(),
        NEAR,
        BYTE_COST - 1,
    )
    .unwrap();
    let before = split.clone();
    assert_eq!(
        charge_actor_storage(&split.actor, split.liabilities, 1, BYTE_COST),
        Err(AuthorityError::StorageCredit)
    );
    assert_eq!(split, before);
    assert_eq!(initial, actor("owner.testnet"));
}

#[test]
fn accounting_topups_preserve_policy_pending_and_other_claims() {
    let mut initial = actor("owner.testnet");
    initial.ledger.available_yocto = U128String(19);
    initial.ledger.storage_credit_yocto = U128String(29);
    initial.ledger.pending_payment_yocto = U128String(37);
    initial.ledger.storage_charged_bytes = U64String(41);
    initial.set_policy(0, U128String(99), 5, false).unwrap();
    let totals = AggregateLiabilities {
        available_yocto: 119,
        storage_credit_yocto: 229,
    };
    let principal = credit_deposit(&initial, totals, 11, 0).unwrap();
    assert_eq!(principal.actor.ledger.available_yocto.0, 30);
    assert_eq!(principal.actor.ledger.storage_credit_yocto.0, 29);
    assert_eq!(principal.liabilities.available_yocto, 130);
    assert_eq!(principal.liabilities.storage_credit_yocto, 229);
    let storage = credit_deposit(&principal.actor, principal.liabilities, 13, 13).unwrap();
    assert_eq!(storage.actor.ledger.available_yocto.0, 30);
    assert_eq!(storage.actor.ledger.storage_credit_yocto.0, 42);
    assert_eq!(storage.liabilities.available_yocto, 130);
    assert_eq!(storage.liabilities.storage_credit_yocto, 242);
    assert_eq!(storage.actor.policy, initial.policy);
    assert_eq!(
        storage.actor.ledger.pending_payment_yocto,
        initial.ledger.pending_payment_yocto
    );
    assert_eq!(
        storage.actor.ledger.storage_charged_bytes,
        initial.ledger.storage_charged_bytes
    );
}

#[test]
fn accounting_storage_never_uses_another_tenants_credit() {
    let mut owner = actor("owner.testnet");
    owner.ledger.available_yocto = U128String(NEAR);
    owner.ledger.storage_credit_yocto = U128String(BYTE_COST - 1);
    let mut other = actor("other.testnet");
    other.ledger.storage_credit_yocto = U128String(NEAR);
    let other_before = other.clone();
    let totals = AggregateLiabilities {
        available_yocto: NEAR,
        storage_credit_yocto: NEAR + BYTE_COST - 1,
    };
    assert_eq!(
        charge_actor_storage(&owner, totals, 1, BYTE_COST),
        Err(AuthorityError::StorageCredit)
    );
    assert_eq!(other, other_before);
    assert_eq!(owner.ledger.available_yocto.0, NEAR);
    assert_eq!(owner.ledger.storage_credit_yocto.0, BYTE_COST - 1);
}

#[test]
fn accounting_overflows_and_aggregate_underflow_leave_inputs_unchanged() {
    for field in 0..4 {
        let mut owner = actor("owner.testnet");
        let mut totals = AggregateLiabilities::default();
        match field {
            0 => owner.ledger.available_yocto = U128String(u128::MAX),
            1 => owner.ledger.storage_credit_yocto = U128String(u128::MAX),
            2 => totals.available_yocto = u128::MAX,
            _ => totals.storage_credit_yocto = u128::MAX,
        }
        let before = owner.clone();
        assert_eq!(
            credit_deposit(&owner, totals, 2, 1),
            Err(AuthorityError::ArithmeticOverflow)
        );
        assert_eq!(owner, before);
    }
    let mut owner = actor("owner.testnet");
    owner.ledger.storage_credit_yocto = U128String(u128::MAX);
    let before = owner.clone();
    assert_eq!(
        charge_actor_storage(&owner, liabilities(&owner), 2, u128::MAX),
        Err(AuthorityError::ArithmeticOverflow)
    );
    assert_eq!(
        charge_actor_storage(&owner, AggregateLiabilities::default(), 1, 1),
        Err(AuthorityError::StorageCredit)
    );
    assert_eq!(owner, before);
    owner.ledger.storage_charged_bytes = U64String(u64::MAX);
    let before = owner.clone();
    assert_eq!(
        charge_actor_storage(&owner, liabilities(&owner), 1, 1),
        Err(AuthorityError::ArithmeticOverflow)
    );
    assert_eq!(owner, before);
}

#[test]
fn accounting_zero_growth_does_not_refund_storage_or_spendable_principal() {
    let mut owner = actor("owner.testnet");
    owner.ledger.available_yocto = U128String(9);
    owner.ledger.storage_credit_yocto = U128String(19);
    owner.ledger.storage_charged_bytes = U64String(29);
    let totals = liabilities(&owner);
    let result = charge_actor_storage(&owner, totals, 0, BYTE_COST).unwrap();
    assert_eq!(result.actor, owner);
    assert_eq!(result.liabilities, totals);
}

#[test]
fn accounting_credit_rewrites_have_fixed_serialized_width() {
    let owner = actor("owner.testnet");
    let initial_bytes = borsh::to_vec(&owner).unwrap();
    let credited = credit_deposit(
        &owner,
        AggregateLiabilities::default(),
        u128::MAX,
        u128::MAX,
    )
    .unwrap();
    let charged = charge_actor_storage(&credited.actor, credited.liabilities, u64::MAX, 1).unwrap();
    assert_eq!(
        borsh::to_vec(&credited.actor).unwrap().len(),
        initial_bytes.len()
    );
    assert_eq!(
        borsh::to_vec(&charged.actor).unwrap().len(),
        initial_bytes.len()
    );
}
