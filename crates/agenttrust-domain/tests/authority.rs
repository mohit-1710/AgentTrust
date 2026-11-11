use agenttrust_domain::{authority::*, owner::*, types::*};

fn account(value: &str) -> AccountId {
    value.parse().unwrap()
}
fn profile(value: &str) -> ProfileId {
    ProfileId::new(value.into()).unwrap()
}
fn id(value: u8) -> Hash32 {
    FixedBytes([value; 32])
}
const KEY: &str = "ed25519:11111111111111111111111111111111";
fn requirement() -> CapabilityRequirement {
    CapabilityRequirement {
        capability_namespace: "invoice.audit".into(),
        capability_version: 1,
        conformance_suite_version: 1,
        conformance_suite_hash: id(8),
        accepted_issuers: vec![account("issuer.testnet")],
    }
}
fn owner() -> ActorState {
    ActorState::new(account("owner.testnet"))
}
fn configured_owner() -> ActorState {
    let mut actor = owner();
    actor
        .set_profile(profile("audit"), None, Some(requirement()))
        .unwrap();
    actor
}
fn registration(value: u8) -> SessionRegistration {
    SessionRegistration {
        session_id: id(value),
        public_key: KEY.into(),
        profile_id: profile("audit"),
        profile_revision: 1,
        purchase_cap_yocto: U128String(10),
        expires_at_ns: U64String(100),
    }
}

#[test]
fn initialization_rejects_arbitrary_first_caller_and_relay() {
    let core = account("core.testnet");
    let stranger = account("stranger.testnet");
    let mut context = CallContext {
        current_account: &core,
        predecessor: &core,
        signer: &core,
        signer_public_key: KEY,
        attached_deposit_yocto: 0,
    };
    assert_eq!(authorize_initialization(&context), Ok(()));
    context.predecessor = &stranger;
    assert_eq!(
        authorize_initialization(&context),
        Err(AuthorityError::Unauthorized)
    );
    context.predecessor = &core;
    context.signer = &stranger;
    assert_eq!(
        authorize_initialization(&context),
        Err(AuthorityError::Unauthorized)
    );
    context.signer = &core;
    context.attached_deposit_yocto = 1;
    assert_eq!(
        authorize_initialization(&context),
        Err(AuthorityError::Unauthorized)
    );
}
#[test]
fn management_requires_direct_exact_one_yocto_and_funded_actor() {
    let core = account("core.testnet");
    let signer = account("owner.testnet");
    let mut context = CallContext {
        current_account: &core,
        predecessor: &signer,
        signer: &signer,
        signer_public_key: KEY,
        attached_deposit_yocto: 1,
    };
    assert_eq!(management_actor(&context), Ok(signer.clone()));
    for amount in [0, 2, u128::MAX] {
        context.attached_deposit_yocto = amount;
        assert_eq!(
            management_actor(&context),
            Err(AuthorityError::Unauthorized)
        );
    }
    context.attached_deposit_yocto = 1;
    context.predecessor = &core;
    assert_eq!(
        management_actor(&context),
        Err(AuthorityError::Unauthorized)
    );
    assert_eq!(require_actor(None), Err(AuthorityError::UnfundedAccount));
    let actor = owner();
    assert_eq!(require_actor(Some(&actor)), Ok(&actor));
}
#[test]
fn worker_requires_actual_owner_key_direct_context_and_zero_deposit() {
    let mut actor = configured_owner();
    let session = actor.register_session(registration(1), 10).unwrap();
    let core = account("core.testnet");
    let other = account("other.testnet");
    let mut context = CallContext {
        current_account: &core,
        predecessor: &actor.owner_id,
        signer: &actor.owner_id,
        signer_public_key: KEY,
        attached_deposit_yocto: 0,
    };
    assert_eq!(
        authenticate_worker(&context, &actor.owner_id, &session),
        Ok(())
    );
    context.signer_public_key = "secp256k1:11111111111111111111111111111111";
    assert_eq!(
        authenticate_worker(&context, &actor.owner_id, &session),
        Err(AuthorityError::Unauthorized)
    );
    context.signer_public_key = KEY;
    context.signer = &other;
    assert_eq!(
        authenticate_worker(&context, &actor.owner_id, &session),
        Err(AuthorityError::Unauthorized)
    );
    context.signer = &actor.owner_id;
    context.predecessor = &core;
    assert_eq!(
        authenticate_worker(&context, &actor.owner_id, &session),
        Err(AuthorityError::Unauthorized)
    );
    context.predecessor = &actor.owner_id;
    context.attached_deposit_yocto = 1;
    assert_eq!(
        authenticate_worker(&context, &actor.owner_id, &session),
        Err(AuthorityError::Unauthorized)
    );
}
#[test]
fn initial_policy_is_closed_and_edits_preserve_money() {
    let mut actor = owner();
    assert!(actor.policy.paused);
    assert_eq!(actor.policy.revision, 0);
    assert_eq!(actor.policy.daily_cap_yocto.0, 0);
    assert_eq!(actor.policy.max_dispatches_per_minute, 0);
    actor.ledger.available_yocto = U128String(77);
    actor.ledger.pending_payment_yocto = U128String(33);
    let before = actor.ledger.clone();
    let policy = actor.set_policy(0, U128String(100), 5, false).unwrap();
    assert_eq!(policy.revision, 1);
    assert_eq!(actor.ledger, before);
    let snapshot = actor.clone();
    assert_eq!(
        actor.set_policy(0, U128String(0), 0, true),
        Err(AuthorityError::RevisionMismatch)
    );
    assert_eq!(actor, snapshot);
}
#[test]
fn profile_revision_and_capability_limits_are_enforced() {
    let mut actor = configured_owner();
    assert_eq!(actor.policy.revision, 1);
    assert_eq!(
        actor.set_profile(profile("audit"), None, None),
        Err(AuthorityError::RevisionMismatch)
    );
    let updated = actor.set_profile(profile("audit"), Some(1), None).unwrap();
    assert_eq!(updated.revision, 2);
    assert_eq!(actor.policy.revision, 2);
    for name in ["two", "three", "four"] {
        actor.set_profile(profile(name), None, None).unwrap();
    }
    assert_eq!(
        actor.set_profile(profile("five"), None, None),
        Err(AuthorityError::Capacity)
    );
    let mut invalid = requirement();
    invalid.accepted_issuers.clear();
    assert_eq!(invalid.validate(), Err(AuthorityError::InvalidProfile));
    invalid = requirement();
    invalid.accepted_issuers = vec![account("issuer.testnet"); 2];
    assert_eq!(invalid.validate(), Err(AuthorityError::InvalidProfile));
    invalid.accepted_issuers = (0..5)
        .map(|i| account(&format!("issuer{i}.testnet")))
        .collect();
    assert_eq!(invalid.validate(), Err(AuthorityError::InvalidProfile));
    for (namespace, version, suite) in [
        ("other", 1, 1),
        ("invoice.audit", 2, 1),
        ("invoice.audit", 1, 0),
    ] {
        invalid = requirement();
        invalid.capability_namespace = namespace.into();
        invalid.capability_version = version;
        invalid.conformance_suite_version = suite;
        assert_eq!(invalid.validate(), Err(AuthorityError::InvalidProfile));
    }
}
#[test]
fn worker_cannot_choose_weaker_profile_or_stale_profile_revision() {
    let mut actor = configured_owner();
    let session = actor.register_session(registration(1), 10).unwrap();
    let current = actor.profiles.get(&profile("audit")).unwrap();
    assert_eq!(
        authorize_session(&session, current, &profile("audit"), 1, 99),
        Ok(())
    );
    assert_eq!(
        authorize_session(&session, current, &profile("weak"), 1, 99),
        Err(AuthorityError::ProfileMismatch)
    );
    assert_eq!(
        authorize_session(&session, current, &profile("audit"), 2, 99),
        Err(AuthorityError::ProfileMismatch)
    );
    let updated = actor.set_profile(profile("audit"), Some(1), None).unwrap();
    assert_eq!(
        authorize_session(&session, &updated, &profile("audit"), 1, 99),
        Err(AuthorityError::ProfileMismatch)
    );
    let before = actor.clone();
    let mut stale = registration(2);
    stale.public_key = "other-key".into();
    assert_eq!(
        actor.register_session(stale, 10),
        Err(AuthorityError::ProfileMismatch)
    );
    assert_eq!(actor, before);
}
#[test]
fn sessions_are_create_only_and_rebinding_requires_revocation() {
    let mut actor = configured_owner();
    let original = actor.register_session(registration(1), 10).unwrap();
    assert_eq!(
        actor.register_session(registration(1), 10),
        Err(AuthorityError::SessionExists)
    );
    assert_eq!(
        actor.register_session(registration(2), 10),
        Err(AuthorityError::DuplicateActiveKey)
    );
    let revoked = actor.revoke_session(&id(1)).unwrap();
    assert!(revoked.revoked);
    assert_eq!(revoked.public_key, original.public_key);
    assert_eq!(revoked.profile_id, original.profile_id);
    assert_eq!(
        actor.register_session(registration(1), 10),
        Err(AuthorityError::SessionExists)
    );
    actor.register_session(registration(2), 10).unwrap();
    assert_eq!(actor.policy.revision, 4);
    let revision = actor.policy.revision;
    actor.revoke_session(&id(1)).unwrap();
    assert_eq!(actor.policy.revision, revision);
}
#[test]
fn session_expiry_revocation_and_retained_capacity_fail_closed() {
    let mut actor = configured_owner();
    let mut entry = registration(1);
    entry.expires_at_ns = U64String(10);
    assert_eq!(
        actor.register_session(entry, 10),
        Err(AuthorityError::SessionExpired)
    );
    for value in 1..=8 {
        actor.register_session(registration(value), 10).unwrap();
        actor.revoke_session(&id(value)).unwrap();
    }
    assert_eq!(
        actor.register_session(registration(9), 10),
        Err(AuthorityError::Capacity)
    );
    let current = actor.profiles.get(&profile("audit")).unwrap();
    let mut session = actor.sessions.get(&id(1)).unwrap().clone();
    assert_eq!(
        authorize_session(&session, current, &profile("audit"), 1, 99),
        Err(AuthorityError::SessionRevoked)
    );
    session.revoked = false;
    assert_eq!(
        authorize_session(&session, current, &profile("audit"), 1, 100),
        Err(AuthorityError::SessionExpired)
    );
}
#[test]
fn revision_overflow_never_partially_mutates_owner_state() {
    let mut actor = configured_owner();
    actor.policy.revision = u32::MAX;
    let before = actor.clone();
    assert_eq!(
        actor.set_policy(u32::MAX, U128String(1), 1, false),
        Err(AuthorityError::RevisionOverflow)
    );
    assert_eq!(actor, before);
    assert_eq!(
        actor.set_profile(profile("new"), None, None),
        Err(AuthorityError::RevisionOverflow)
    );
    assert_eq!(actor, before);
    assert_eq!(
        actor.register_session(registration(1), 10),
        Err(AuthorityError::RevisionOverflow)
    );
    assert_eq!(actor, before);
    actor.policy.revision = 1;
    actor.profiles.get_mut(&profile("audit")).unwrap().revision = u32::MAX;
    let before = actor.clone();
    assert_eq!(
        actor.set_profile(profile("audit"), Some(u32::MAX), None),
        Err(AuthorityError::RevisionOverflow)
    );
    assert_eq!(actor, before);
}

#[test]
fn storage_growth_charges_only_actor_credit_and_fails_without_partial_changes() {
    let mut actor = owner();
    actor.ledger.storage_credit_yocto = U128String(100);
    actor.ledger.available_yocto = U128String(500);
    assert_eq!(actor.charge_storage_growth(4, 10), Ok(40));
    assert_eq!(actor.ledger.storage_credit_yocto.0, 60);
    assert_eq!(actor.ledger.storage_charged_bytes.0, 4);
    assert_eq!(actor.ledger.available_yocto.0, 500);
    let before = actor.clone();
    assert_eq!(
        actor.charge_storage_growth(7, 10),
        Err(AuthorityError::StorageCredit)
    );
    assert_eq!(actor, before);
    assert_eq!(
        actor.charge_storage_growth(2, u128::MAX),
        Err(AuthorityError::ArithmeticOverflow)
    );
    assert_eq!(actor, before);
    assert_eq!(actor.charge_storage_growth(0, 10), Ok(0));
    assert_eq!(actor, before);
}
