use agenttrust_domain::{
    authority::AuthorityError,
    owner::{ActorState, CapabilityRequirement, OwnerPolicy, Profile, Session, TrustEntry},
    policy::{
        self, BackingSnapshot, CredentialEvidence, CredentialFailure as C, Decision,
        DenialCode as D, MINUTE_NS, PolicySnapshot, UsageSnapshot,
    },
    registry::{Credential, CredentialAssertion, CredentialRef, ServiceIdentity},
    types::{AccountId, FixedBytes, InvoiceV1, ProfileId, U64String, U128String},
};
const NOW: u64 = 1_800_000_000_000_000_000;
const PRICE: u128 = 10_000_000_000_000_000_000_000; //0.01 NEAR
fn account(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn profile(s: &str) -> ProfileId {
    ProfileId::new(s.to_owned()).unwrap()
}
struct Fixture {
    core: AccountId,
    actor: ActorState,
    invoice: InvoiceV1,
    service: ServiceIdentity,
    credential: Credential,
    reference: CredentialRef,
    usage: UsageSnapshot,
    backing: BackingSnapshot,
    signature_valid: bool,
    has_service: bool,
    has_reference: bool,
    has_credential: bool,
    now: u64,
}
impl Fixture {
    fn new() -> Self {
        let core = account("core.testnet");
        let owner = account("owner.testnet");
        let issuer = account("issuer.testnet");
        let requirement = CapabilityRequirement {
            capability_namespace: "invoice.audit".into(),
            capability_version: 1,
            conformance_suite_version: 2,
            conformance_suite_hash: FixedBytes([42; 32]),
            accepted_issuers: vec![issuer.clone()],
        };
        let mut actor = ActorState::new(owner.clone());
        actor.ledger.available_yocto = U128String(100 * PRICE);
        actor.ledger.storage_credit_yocto = U128String(PRICE);
        actor.policy = OwnerPolicy {
            revision: 7,
            paused: false,
            daily_cap_yocto: U128String(5 * PRICE),
            max_dispatches_per_minute: 5,
        };
        actor.profiles.insert(
            profile("audit"),
            Profile {
                profile_id: profile("audit"),
                revision: 2,
                requirement: Some(requirement),
            },
        );
        actor.sessions.insert(
            FixedBytes([3; 32]),
            Session {
                session_id: FixedBytes([3; 32]),
                public_key: "ed25519:fixture".into(),
                profile_id: profile("audit"),
                profile_revision: 2,
                purchase_cap_yocto: U128String(2 * PRICE),
                expires_at_ns: U64String(NOW + 86_400_000_000_000),
                revoked: false,
            },
        );
        let service = ServiceIdentity {
            service_id: account("audit.testnet"),
            version: 3,
            payout_account: account("seller.testnet"),
            invoice_key: FixedBytes([1; 32]),
            endpoint_hash: FixedBytes([2; 32]),
            active: true,
        };
        actor.trusted_services.insert(
            service.service_id.clone(),
            TrustEntry {
                service_id: service.service_id.clone(),
                service_version: 3,
                payout_account: service.payout_account.clone(),
                invoice_key: service.invoice_key,
                endpoint_hash: service.endpoint_hash,
                allowed_profile_ids: vec![profile("audit")],
                expires_at_ns: None,
                active: true,
            },
        );
        let credential = Credential {
            issuer_id: issuer,
            credential_id: FixedBytes([9; 32]),
            revision: 4,
            revoked: false,
            assertion: CredentialAssertion {
                service_id: service.service_id.clone(),
                service_version: 3,
                capability_namespace: "invoice.audit".into(),
                capability_version: 1,
                conformance_suite_version: 2,
                conformance_suite_hash: FixedBytes([42; 32]),
                evidence_manifest_hash: FixedBytes([43; 32]),
                issued_at_ns: U64String(NOW - 10_000_000_000),
                expires_at_ns: U64String(NOW + 3_600_000_000_000),
            },
        };
        let reference = credential.reference();
        let invoice = InvoiceV1 {
            schema_version: 1,
            network: "near:testnet".into(),
            core_account: core.clone(),
            owner_id: owner,
            session_id: FixedBytes([3; 32]),
            payment_id: FixedBytes([4; 32]),
            policy_revision: 7,
            profile_id: profile("audit"),
            profile_revision: 2,
            service_id: service.service_id.clone(),
            service_version: 3,
            payout_account: service.payout_account.clone(),
            endpoint_hash: service.endpoint_hash,
            request_hash: FixedBytes([5; 32]),
            asset: "NEAR".into(),
            amount_yocto: U128String(PRICE),
            issued_at_ns: U64String(NOW),
            expires_at_ns: U64String(NOW + 120_000_000_000),
        };
        let backing = BackingSnapshot {
            runtime_balance_yocto: 104 * PRICE,
            storage_stake_yocto: PRICE,
            operating_reserve_yocto: 2 * PRICE,
            aggregate_available_yocto: 100 * PRICE,
            aggregate_storage_credit_yocto: PRICE,
            storage_charge_yocto: PRICE / 100,
        };
        Self {
            core,
            actor,
            invoice,
            service,
            credential,
            reference,
            usage: UsageSnapshot {
                minute_bucket: NOW / MINUTE_NS,
                ..UsageSnapshot::default()
            },
            backing,
            signature_valid: true,
            has_service: true,
            has_reference: true,
            has_credential: true,
            now: NOW,
        }
    }
    fn evaluate(&self) -> Decision {
        policy::evaluate(
            &PolicySnapshot {
                now_ns: self.now,
                network: "near:testnet",
                core_account: &self.core,
                owner: &self.actor,
                service: self.has_service.then_some(&self.service),
                signature_valid: self.signature_valid,
                usage: self.usage,
                backing: self.backing,
            },
            &self.invoice,
            CredentialEvidence {
                reference: self.has_reference.then_some(&self.reference),
                record: self.has_credential.then_some(&self.credential),
            },
        )
    }
    fn session(&mut self) -> &mut Session {
        self.actor
            .sessions
            .get_mut(&self.invoice.session_id)
            .unwrap()
    }
    fn trust(&mut self) -> &mut TrustEntry {
        self.actor
            .trusted_services
            .get_mut(&self.invoice.service_id)
            .unwrap()
    }
    fn requirement(&mut self) -> &mut CapabilityRequirement {
        self.actor
            .profiles
            .get_mut(&profile("audit"))
            .unwrap()
            .requirement
            .as_mut()
            .unwrap()
    }
}
fn deny(f: &Fixture, code: D) {
    assert_eq!(f.evaluate(), Decision::deny(code));
}
fn validation(f: &Fixture, code: C) {
    let requirement = f
        .actor
        .profiles
        .get(&profile("audit"))
        .unwrap()
        .requirement
        .clone()
        .unwrap();
    assert_eq!(
        f.evaluate(),
        Decision::RequireValidation { code, requirement }
    );
}
#[test]
fn policy_allows_complete_evidence_and_is_read_only() {
    let f = Fixture::new();
    let before = f.actor.clone();
    assert_eq!(f.evaluate(), Decision::Allow);
    assert_eq!(f.actor, before);
    assert_eq!(f.evaluate(), Decision::Allow);
    assert_eq!(f.actor, before);
}
#[test]
fn policy_owner_session_identity_revocation_precede_business_checks() {
    let mut f = Fixture::new();
    f.invoice.owner_id = account("other.testnet");
    deny(&f, D::Unauthorized);
    let mut f = Fixture::new();
    f.invoice.session_id = FixedBytes([99; 32]);
    deny(&f, D::Unauthorized);
    let mut f = Fixture::new();
    f.session().session_id = FixedBytes([99; 32]);
    deny(&f, D::Unauthorized);
    let mut f = Fixture::new();
    f.session().revoked = true;
    f.actor.policy.paused = true;
    deny(&f, D::SessionRevoked);
    let mut f = Fixture::new();
    f.session().expires_at_ns = U64String(NOW);
    deny(&f, D::SessionExpired);
}
#[test]
fn policy_pause_and_profile_policy_revisions_are_unconditional() {
    let mut f = Fixture::new();
    f.actor.policy.paused = true;
    f.signature_valid = false;
    f.has_credential = false;
    deny(&f, D::Paused);
    let mut f = Fixture::new();
    f.invoice.profile_id = profile("weaker");
    deny(&f, D::ProfileMismatch);
    let mut f = Fixture::new();
    f.invoice.profile_revision = 1;
    deny(&f, D::ProfileMismatch);
    let mut f = Fixture::new();
    f.actor
        .profiles
        .get_mut(&profile("audit"))
        .unwrap()
        .revision = 3;
    deny(&f, D::ProfileMismatch);
    let mut f = Fixture::new();
    f.invoice.policy_revision -= 1;
    deny(&f, D::PolicyChanged);
    let mut f = Fixture::new();
    f.actor.profiles.remove(&profile("audit"));
    deny(&f, D::ProfileMismatch);
}
#[test]
fn policy_domain_schema_asset_and_zero_amount_fail_closed() {
    let mut f = Fixture::new();
    f.invoice.network = "near:mainnet".into();
    deny(&f, D::DomainMismatch);
    let mut f = Fixture::new();
    f.invoice.core_account = account("else.testnet");
    deny(&f, D::DomainMismatch);
    let mut f = Fixture::new();
    f.invoice.schema_version = 2;
    deny(&f, D::InvalidInvoice);
    let mut f = Fixture::new();
    f.invoice.asset = "OTHER".into();
    deny(&f, D::InvalidInvoice);
    let mut f = Fixture::new();
    f.invoice.amount_yocto = U128String(0);
    deny(&f, D::InvalidInvoice);
}
#[test]
fn policy_invoice_time_boundaries_are_strict_and_checked() {
    let mut f = Fixture::new();
    f.invoice.expires_at_ns = U64String(NOW);
    deny(&f, D::InvoiceExpired);
    let mut f = Fixture::new();
    f.invoice.issued_at_ns = U64String(NOW + 5_000_000_000);
    assert_eq!(f.evaluate(), Decision::Allow);
    f.invoice.issued_at_ns.0 += 1;
    deny(&f, D::InvalidInvoice);
    let mut f = Fixture::new();
    f.invoice.expires_at_ns = U64String(NOW + 300_000_000_000);
    assert_eq!(f.evaluate(), Decision::Allow);
    f.invoice.expires_at_ns.0 += 1;
    deny(&f, D::InvalidInvoice);
    let mut f = Fixture::new();
    f.invoice.issued_at_ns = f.invoice.expires_at_ns;
    deny(&f, D::InvalidInvoice);
    let mut f = Fixture::new();
    f.invoice.issued_at_ns = U64String(u64::MAX);
    deny(&f, D::InvalidInvoice);
}
#[test]
fn policy_identity_and_signature_precede_owner_blocks() {
    for field in 0..6 {
        let mut f = Fixture::new();
        match field {
            0 => f.has_service = false,
            1 => f.service.active = false,
            2 => f.service.service_id = account("other.testnet"),
            3 => f.service.version += 1,
            4 => f.service.payout_account = account("other.testnet"),
            _ => f.service.endpoint_hash = FixedBytes([8; 32]),
        };
        f.actor
            .blocked_services
            .insert(f.invoice.service_id.clone());
        deny(&f, D::IdentityChanged);
    }
    let mut f = Fixture::new();
    f.signature_valid = false;
    f.actor
        .blocked_services
        .insert(f.invoice.service_id.clone());
    deny(&f, D::InvalidInvoice);
}
#[test]
fn policy_blocks_win_over_limits_capability_and_trust() {
    let mut f = Fixture::new();
    f.actor
        .blocked_services
        .insert(f.invoice.service_id.clone());
    f.actor
        .blocked_payouts
        .insert(f.invoice.payout_account.clone());
    f.invoice.amount_yocto = U128String(3 * PRICE);
    f.has_credential = false;
    f.actor.trusted_services.clear();
    deny(&f, D::BlockedService);
    f.actor.blocked_services.clear();
    deny(&f, D::BlockedPayout);
}
#[test]
fn policy_purchase_and_daily_caps_accept_exact_reject_one_more() {
    let mut f = Fixture::new();
    f.invoice.amount_yocto = U128String(2 * PRICE);
    assert_eq!(f.evaluate(), Decision::Allow);
    f.invoice.amount_yocto.0 += 1;
    deny(&f, D::PurchaseCap);
    let mut f = Fixture::new();
    f.usage.settled_current_day_yocto = PRICE;
    f.actor.ledger.pending_payment_yocto = U128String(3 * PRICE);
    assert_eq!(f.evaluate(), Decision::Allow);
    f.invoice.amount_yocto.0 += 1;
    deny(&f, D::DailyCap);
    let mut f = Fixture::new();
    f.actor.policy.daily_cap_yocto = U128String(u128::MAX);
    f.usage.settled_current_day_yocto = u128::MAX;
    deny(&f, D::DailyCap);
}
#[test]
fn policy_sibling_sessions_share_pending_and_daily_usage() {
    let mut f = Fixture::new();
    f.actor.ledger.pending_payment_yocto = U128String(4 * PRICE);
    f.usage.settled_current_day_yocto = 1;
    deny(&f, D::DailyCap);
    let mut sibling = f.session().clone();
    sibling.session_id = FixedBytes([7; 32]);
    sibling.public_key = "ed25519:sibling".into();
    f.actor.sessions.insert(sibling.session_id, sibling.clone());
    f.invoice.session_id = sibling.session_id;
    deny(&f, D::DailyCap);
    f.usage.settled_current_day_yocto = 0;
    assert_eq!(f.evaluate(), Decision::Allow);
}
#[test]
fn policy_fixed_minute_rate_is_owner_wide_with_string_retry_time() {
    let mut f = Fixture::new();
    f.usage.dispatched_in_minute = 4;
    assert_eq!(f.evaluate(), Decision::Allow);
    f.usage.dispatched_in_minute = 5;
    assert_eq!(
        f.evaluate(),
        Decision::Deny {
            code: D::RateLimit,
            retry_after_ns: Some(U64String((NOW / MINUTE_NS + 1) * MINUTE_NS))
        }
    );
    let mut sibling = f.session().clone();
    sibling.session_id = FixedBytes([7; 32]);
    sibling.public_key = "ed25519:sibling".into();
    f.actor.sessions.insert(sibling.session_id, sibling.clone());
    f.invoice.session_id = sibling.session_id;
    assert!(matches!(
        f.evaluate(),
        Decision::Deny {
            code: D::RateLimit,
            ..
        }
    ));
    f.usage.minute_bucket -= 1;
    assert_eq!(f.evaluate(), Decision::Allow);
    f.actor.policy.max_dispatches_per_minute = 0;
    assert!(matches!(
        f.evaluate(),
        Decision::Deny {
            code: D::RateLimit,
            ..
        }
    ));
}
#[test]
fn policy_funds_storage_backing_capacity_precede_capability() {
    let mut f = Fixture::new();
    f.actor.ledger.available_yocto = U128String(PRICE - 1);
    f.has_credential = false;
    deny(&f, D::InsufficientFunds);
    let mut f = Fixture::new();
    f.actor.ledger.storage_credit_yocto = U128String(f.backing.storage_charge_yocto - 1);
    f.has_credential = false;
    deny(&f, D::StorageCredit);
    let mut f = Fixture::new();
    f.backing.runtime_balance_yocto -= 1;
    f.has_credential = false;
    deny(&f, D::InsufficientBacking);
    let mut f = Fixture::new();
    f.usage.outstanding_transfers = 8;
    f.has_credential = false;
    deny(&f, D::Capacity);
    let mut f = Fixture::new();
    f.usage.retained_payments = 128;
    deny(&f, D::Capacity);
    let mut f = Fixture::new();
    f.usage.outstanding_transfers = 7;
    f.usage.retained_payments = 127;
    assert_eq!(f.evaluate(), Decision::Allow);
}
#[test]
fn policy_backing_does_not_double_count_credit_pending_or_drop_transfer_amount() {
    let mut f = Fixture::new();
    f.actor.ledger.pending_payment_yocto = U128String(PRICE);
    assert_eq!(f.evaluate(), Decision::Allow);
    f.backing.storage_charge_yocto = PRICE;
    assert_eq!(f.evaluate(), Decision::Allow);
    f.backing.aggregate_storage_credit_yocto = PRICE - 1;
    deny(&f, D::StorageCredit);
    let mut f = Fixture::new();
    f.backing.aggregate_available_yocto = u128::MAX;
    deny(&f, D::InsufficientBacking);
    let mut f = Fixture::new();
    f.backing.storage_stake_yocto = u128::MAX;
    deny(&f, D::InsufficientBacking);
    let mut f = Fixture::new();
    f.actor.ledger.available_yocto = U128String(PRICE);
    f.backing.aggregate_available_yocto = PRICE;
    f.backing.runtime_balance_yocto = 5 * PRICE - 1;
    deny(&f, D::InsufficientBacking);
}
#[test]
fn policy_missing_and_unaccepted_evidence_cannot_be_bypassed() {
    let mut f = Fixture::new();
    f.has_reference = false;
    validation(&f, C::Missing);
    let mut f = Fixture::new();
    f.has_credential = false;
    validation(&f, C::Missing);
    let mut f = Fixture::new();
    f.reference.issuer_id = account("unaccepted.testnet");
    validation(&f, C::UnacceptedIssuer);
    let mut f = Fixture::new();
    f.requirement().accepted_issuers.clear();
    validation(&f, C::UnacceptedIssuer);
    let mut f = Fixture::new();
    f.requirement()
        .accepted_issuers
        .push(account("issuer.testnet"));
    validation(&f, C::UnacceptedIssuer);
}
#[test]
fn policy_credentials_pin_ref_subject_scope_suite_dates_and_revocation() {
    let mut f = Fixture::new();
    f.credential.credential_id = FixedBytes([99; 32]);
    validation(&f, C::Missing);
    let mut f = Fixture::new();
    f.credential.revision += 1;
    validation(&f, C::RevisionChanged);
    let mut f = Fixture::new();
    f.credential.assertion.service_id = account("else.testnet");
    validation(&f, C::WrongSubject);
    let mut f = Fixture::new();
    f.credential.assertion.service_version += 1;
    validation(&f, C::WrongSubject);
    let mut f = Fixture::new();
    f.credential.assertion.capability_namespace = "other".into();
    validation(&f, C::WrongScope);
    let mut f = Fixture::new();
    f.credential.assertion.capability_version += 1;
    validation(&f, C::WrongScope);
    let mut f = Fixture::new();
    f.credential.assertion.conformance_suite_version += 1;
    validation(&f, C::WrongSuite);
    let mut f = Fixture::new();
    f.credential.assertion.conformance_suite_hash = FixedBytes([43; 32]);
    validation(&f, C::WrongSuite);
    let mut f = Fixture::new();
    f.credential.assertion.evidence_manifest_hash = FixedBytes([99; 32]);
    assert_eq!(f.evaluate(), Decision::Allow);
    let mut f = Fixture::new();
    f.credential.assertion.expires_at_ns = U64String(NOW);
    validation(&f, C::Expired);
    let mut f = Fixture::new();
    f.credential.assertion.issued_at_ns = U64String(NOW + 5_000_000_001);
    validation(&f, C::Expired);
    let mut f = Fixture::new();
    f.credential.revoked = true;
    validation(&f, C::Revoked);
}
#[test]
fn policy_capability_precedes_trust_and_null_requirement_is_explicit() {
    let mut f = Fixture::new();
    f.has_credential = false;
    f.actor.trusted_services.clear();
    validation(&f, C::Missing);
    f.actor
        .profiles
        .get_mut(&profile("audit"))
        .unwrap()
        .requirement = None;
    deny(&f, D::UnknownService);
    let mut f = Fixture::new();
    f.actor
        .profiles
        .get_mut(&profile("audit"))
        .unwrap()
        .requirement = None;
    f.has_reference = false;
    f.has_credential = false;
    assert_eq!(f.evaluate(), Decision::Allow);
}
#[test]
fn policy_exact_trust_required_unknown_inactive_expired_or_wrong_profile_denies() {
    let mut f = Fixture::new();
    f.actor.trusted_services.clear();
    deny(&f, D::UnknownService);
    let mut f = Fixture::new();
    f.trust().active = false;
    deny(&f, D::UnknownService);
    let mut f = Fixture::new();
    f.trust().expires_at_ns = Some(U64String(NOW));
    deny(&f, D::UnknownService);
    let mut f = Fixture::new();
    f.trust().allowed_profile_ids = vec![profile("else")];
    deny(&f, D::UnknownService);
    for field in 0..5 {
        let mut f = Fixture::new();
        match field {
            0 => f.trust().service_id = account("other.testnet"),
            1 => f.trust().service_version += 1,
            2 => f.trust().payout_account = account("other.testnet"),
            3 => f.trust().endpoint_hash = FixedBytes([99; 32]),
            _ => f.trust().invoice_key = FixedBytes([99; 32]),
        };
        deny(&f, D::IdentityChanged);
    }
}
#[test]
fn policy_wire_codes_and_time_strings_match_protocol() {
    assert_eq!(
        serde_json::to_value(Decision::Allow).unwrap(),
        serde_json::json!({"kind":"allow"})
    );
    let mut f = Fixture::new();
    f.usage.dispatched_in_minute = 5;
    let json = serde_json::to_value(f.evaluate()).unwrap();
    assert_eq!(json["kind"], "deny");
    assert_eq!(json["code"], "RATE_LIMIT");
    assert!(json["retry_after_ns"].is_string());
    f.usage.dispatched_in_minute = 0;
    f.has_credential = false;
    let json = serde_json::to_value(f.evaluate()).unwrap();
    assert_eq!(json["kind"], "require_validation");
    assert_eq!(json["code"], "MISSING");
    assert_eq!(json["requirement"]["capability_namespace"], "invoice.audit");
}
#[test]
fn trust_copies_exact_registry_identity_and_noop_preserves_revision() {
    let mut f = Fixture::new();
    let ledger = f.actor.ledger.clone();
    let revision = f.actor.policy.revision;
    let same = f
        .actor
        .set_service_trust(&f.service, 3, vec![profile("audit")], None, true, NOW)
        .unwrap();
    assert_eq!(same, *f.trust());
    assert_eq!(f.actor.policy.revision, revision);
    f.service.version = 4;
    f.service.payout_account = account("changed.testnet");
    f.service.invoice_key = FixedBytes([10; 32]);
    f.service.endpoint_hash = FixedBytes([11; 32]);
    let entry = f
        .actor
        .set_service_trust(
            &f.service,
            4,
            vec![profile("audit")],
            Some(U64String(NOW + 1)),
            true,
            NOW,
        )
        .unwrap();
    assert_eq!(entry.service_version, 4);
    assert_eq!(entry.payout_account, f.service.payout_account);
    assert_eq!(entry.invoice_key, f.service.invoice_key);
    assert_eq!(entry.endpoint_hash, f.service.endpoint_hash);
    assert_eq!(f.actor.policy.revision, revision + 1);
    assert_eq!(f.actor.ledger, ledger);
}
#[test]
fn trust_rejects_invalid_config_and_overflow_without_mutation() {
    let f = Fixture::new();
    for ids in [
        vec![],
        vec![profile("audit"), profile("audit")],
        vec![profile("missing")],
        vec![profile("audit"); 5],
    ] {
        let mut a = f.actor.clone();
        assert_eq!(
            a.set_service_trust(&f.service, 3, ids, None, true, NOW),
            Err(AuthorityError::InvalidTrust)
        );
        assert_eq!(a, f.actor);
    }
    let mut a = f.actor.clone();
    assert_eq!(
        a.set_service_trust(&f.service, 2, vec![profile("audit")], None, true, NOW),
        Err(AuthorityError::IdentityChanged)
    );
    assert_eq!(a, f.actor);
    let mut a = f.actor.clone();
    assert_eq!(
        a.set_service_trust(
            &f.service,
            3,
            vec![profile("audit")],
            Some(U64String(NOW)),
            true,
            NOW
        ),
        Err(AuthorityError::InvalidTrust)
    );
    assert_eq!(a, f.actor);
    let mut a = f.actor.clone();
    a.policy.revision = u32::MAX;
    let before = a.clone();
    assert_eq!(
        a.set_service_trust(&f.service, 3, vec![profile("audit")], None, false, NOW),
        Err(AuthorityError::RevisionOverflow)
    );
    assert_eq!(a, before);
}
#[test]
fn inactive_trust_is_retained_within_capacity_and_can_be_updated() {
    let mut f = Fixture::new();
    f.actor.trusted_services.clear();
    for i in 0..32 {
        let mut s = f.service.clone();
        s.service_id = account(&format!("service{i}.testnet"));
        f.actor
            .set_service_trust(&s, 3, vec![profile("audit")], None, false, NOW)
            .unwrap();
    }
    assert_eq!(f.actor.trusted_services.len(), 32);
    let before = f.actor.clone();
    assert_eq!(
        f.actor
            .set_service_trust(&f.service, 3, vec![profile("audit")], None, true, NOW),
        Err(AuthorityError::Capacity)
    );
    assert_eq!(f.actor, before);
    let mut s = f.service.clone();
    s.service_id = account("service0.testnet");
    f.actor
        .set_service_trust(&s, 3, vec![profile("audit")], None, true, NOW)
        .unwrap();
    assert_eq!(f.actor.trusted_services.len(), 32);
}
#[test]
fn blocks_are_bounded_explicit_unblock_frees_membership_without_money_changes() {
    let mut f = Fixture::new();
    let ledger = f.actor.ledger.clone();
    let revision = f.actor.policy.revision;
    f.actor
        .block_service(f.service.service_id.clone(), false)
        .unwrap();
    assert_eq!(f.actor.policy.revision, revision);
    for i in 0..32 {
        f.actor
            .block_service(account(&format!("blocked{i}.testnet")), true)
            .unwrap();
        f.actor
            .block_payout(account(&format!("payout{i}.testnet")), true)
            .unwrap();
    }
    let before = f.actor.clone();
    assert_eq!(
        f.actor.block_service(account("overflow.testnet"), true),
        Err(AuthorityError::Capacity)
    );
    assert_eq!(
        f.actor.block_payout(account("overflow.testnet"), true),
        Err(AuthorityError::Capacity)
    );
    assert_eq!(f.actor, before);
    f.actor
        .block_service(account("blocked0.testnet"), true)
        .unwrap();
    assert_eq!(f.actor, before);
    f.actor
        .block_service(account("blocked0.testnet"), false)
        .unwrap();
    f.actor
        .block_service(account("replacement.testnet"), true)
        .unwrap();
    assert_eq!(f.actor.blocked_services.len(), 32);
    assert_eq!(f.actor.ledger, ledger);
    let mut a = f.actor.clone();
    a.policy.revision = u32::MAX;
    let before = a.clone();
    assert_eq!(
        a.block_payout(account("payout0.testnet"), false),
        Err(AuthorityError::RevisionOverflow)
    );
    assert_eq!(a, before);
}
