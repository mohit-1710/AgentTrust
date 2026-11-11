use agenttrust_domain::{
    accounting::{AggregateLiabilities, charge_actor_storage},
    authority::AuthorityError,
    owner::ActorState,
    registry::{
        CREDENTIAL_CLOCK_SKEW_NS, Credential, CredentialAssertion, MAX_ISSUED_CREDENTIALS,
        RegistryError, ServiceIdentity, ServiceUpdate, credential_dates_valid, issue_credential,
        revoke_credential, set_service,
    },
    types::{AccountId, FixedBytes, U64String, U128String},
};

const NOW: u64 = 1_000_000_000_000;
fn account(value: &str) -> AccountId {
    value.parse().unwrap()
}
fn update() -> ServiceUpdate {
    ServiceUpdate {
        payout_account: account("payout.testnet"),
        invoice_key: FixedBytes([11; 32]),
        endpoint_hash: FixedBytes([12; 32]),
        active: true,
    }
}
fn service() -> ServiceIdentity {
    ServiceIdentity {
        service_id: account("merchant.testnet"),
        version: 3,
        payout_account: account("payout.testnet"),
        invoice_key: FixedBytes([11; 32]),
        endpoint_hash: FixedBytes([12; 32]),
        active: true,
    }
}
fn assertion() -> CredentialAssertion {
    CredentialAssertion {
        service_id: account("merchant.testnet"),
        service_version: 3,
        capability_namespace: "invoice.audit".into(),
        capability_version: 1,
        conformance_suite_version: 1,
        conformance_suite_hash: FixedBytes([13; 32]),
        evidence_manifest_hash: FixedBytes([14; 32]),
        issued_at_ns: U64String(NOW),
        expires_at_ns: U64String(NOW + 60_000_000_000),
    }
}
fn credential() -> Credential {
    Credential {
        issuer_id: account("issuer.testnet"),
        credential_id: FixedBytes([1; 32]),
        revision: 7,
        revoked: false,
        assertion: assertion(),
    }
}
fn issue(
    value: CredentialAssertion,
) -> Result<agenttrust_domain::registry::CredentialIssue, RegistryError> {
    issue_credential(
        &account("issuer.testnet"),
        FixedBytes([1; 32]),
        None,
        None,
        0,
        value,
        Some(&service()),
        NOW,
    )
}

#[test]
fn registry_service_identity_is_caller_owned_and_versioned() {
    let merchant = account("merchant.testnet");
    let created = set_service(&merchant, None, None, update()).unwrap();
    assert_eq!(created.service_id, merchant);
    assert_eq!(created.version, 1);
    assert_eq!(created.payout_account, account("payout.testnet"));
    let mut change = update();
    change.payout_account = account("rotated.testnet");
    change.invoice_key = FixedBytes([21; 32]);
    change.endpoint_hash = FixedBytes([22; 32]);
    let changed = set_service(&merchant, Some(&created), Some(1), change).unwrap();
    assert_eq!(changed.version, 2);
    assert_ne!(changed.payout_account, created.payout_account);
    assert_ne!(changed.invoice_key, created.invoice_key);
    assert_ne!(changed.endpoint_hash, created.endpoint_hash);
    let mut disable = update();
    disable.active = false;
    let disabled = set_service(&merchant, Some(&changed), Some(2), disable).unwrap();
    assert_eq!(disabled.version, 3);
    assert!(!disabled.active);
    assert_eq!(created.version, 1);
}

#[test]
fn registry_service_rejects_foreign_actor_stale_version_and_overflow() {
    let current = service();
    let unchanged = current.clone();
    assert_eq!(
        set_service(&account("other.testnet"), Some(&current), Some(3), update()),
        Err(RegistryError::Unauthorized)
    );
    for expected in [None, Some(2), Some(4)] {
        assert_eq!(
            set_service(&current.service_id, Some(&current), expected, update()),
            Err(RegistryError::VersionMismatch)
        );
    }
    assert_eq!(
        set_service(&current.service_id, None, Some(0), update()),
        Err(RegistryError::VersionMismatch)
    );
    let mut maximum = current.clone();
    maximum.version = u32::MAX;
    assert_eq!(
        set_service(
            &maximum.service_id,
            Some(&maximum),
            Some(u32::MAX),
            update()
        ),
        Err(RegistryError::RevisionOverflow)
    );
    assert_eq!(current, unchanged);
}

#[test]
fn registry_credential_pins_issuer_subject_suite_and_distinct_evidence() {
    let created = issue(assertion()).unwrap();
    assert_eq!(created.retained_count, 1);
    assert_eq!(created.credential.issuer_id, account("issuer.testnet"));
    assert_eq!(created.credential.credential_id, FixedBytes([1; 32]));
    assert_eq!(created.credential.revision, 1);
    assert!(!created.credential.revoked);
    assert_eq!(created.credential.assertion.service_version, 3);
    assert_ne!(
        created.credential.assertion.conformance_suite_hash,
        created.credential.assertion.evidence_manifest_hash
    );
    assert_eq!(created.credential.reference().revision, 1);
}

#[test]
fn registry_credential_namespace_is_issuer_and_id_scoped() {
    let existing = credential();
    for (issuer, id) in [
        (account("other.testnet"), existing.credential_id),
        (existing.issuer_id.clone(), FixedBytes([2; 32])),
    ] {
        assert_eq!(
            issue_credential(
                &issuer,
                id,
                Some(&existing),
                Some(7),
                1,
                assertion(),
                Some(&service()),
                NOW
            ),
            Err(RegistryError::Unauthorized)
        );
        assert_eq!(
            revoke_credential(&issuer, id, Some(&existing)),
            Err(RegistryError::Unauthorized)
        );
    }
    assert_eq!(
        revoke_credential(&existing.issuer_id, existing.credential_id, None),
        Err(RegistryError::CredentialMissing)
    );
    let other_issuer = issue_credential(
        &account("other.testnet"),
        existing.credential_id,
        None,
        None,
        0,
        assertion(),
        Some(&service()),
        NOW,
    )
    .unwrap();
    assert_ne!(other_issuer.credential.issuer_id, existing.issuer_id);
}

#[test]
fn registry_revocation_is_idempotent_and_renewal_invalidates_old_reference() {
    let existing = credential();
    let original_reference = existing.reference();
    let revoked =
        revoke_credential(&existing.issuer_id, existing.credential_id, Some(&existing)).unwrap();
    assert!(revoked.revoked);
    assert_eq!(revoked.revision, 7);
    assert_eq!(
        borsh::to_vec(&revoked).unwrap().len(),
        borsh::to_vec(&existing).unwrap().len()
    );
    assert_eq!(revoked.reference(), original_reference);
    assert_eq!(
        revoke_credential(&existing.issuer_id, existing.credential_id, Some(&revoked)).unwrap(),
        revoked
    );
    let renewed = issue_credential(
        &existing.issuer_id,
        existing.credential_id,
        Some(&revoked),
        Some(7),
        1,
        assertion(),
        Some(&service()),
        NOW,
    )
    .unwrap();
    assert_eq!(renewed.credential.revision, 8);
    assert!(!renewed.credential.revoked);
    assert_ne!(renewed.credential.reference(), original_reference);
    assert_eq!(renewed.retained_count, 1);
    assert!(!existing.revoked);
}

#[test]
fn registry_credential_revisions_are_checked_and_failure_does_not_mutate() {
    let mut existing = credential();
    let before = existing.clone();
    for expected in [None, Some(6), Some(8)] {
        assert_eq!(
            issue_credential(
                &existing.issuer_id,
                existing.credential_id,
                Some(&existing),
                expected,
                1,
                assertion(),
                Some(&service()),
                NOW
            ),
            Err(RegistryError::RevisionMismatch)
        );
    }
    assert_eq!(
        issue_credential(
            &existing.issuer_id,
            existing.credential_id,
            None,
            Some(0),
            0,
            assertion(),
            Some(&service()),
            NOW
        ),
        Err(RegistryError::RevisionMismatch)
    );
    assert_eq!(existing, before);
    existing.revision = u32::MAX;
    assert_eq!(
        issue_credential(
            &existing.issuer_id,
            existing.credential_id,
            Some(&existing),
            Some(u32::MAX),
            1,
            assertion(),
            Some(&service()),
            NOW
        ),
        Err(RegistryError::RevisionOverflow)
    );
}

#[test]
fn registry_credential_retained_capacity_counts_revoked_records() {
    let existing = credential();
    assert_eq!(
        issue_credential(
            &existing.issuer_id,
            FixedBytes([2; 32]),
            None,
            None,
            MAX_ISSUED_CREDENTIALS,
            assertion(),
            Some(&service()),
            NOW
        ),
        Err(RegistryError::Capacity)
    );
    let revoked =
        revoke_credential(&existing.issuer_id, existing.credential_id, Some(&existing)).unwrap();
    let renewal = issue_credential(
        &existing.issuer_id,
        existing.credential_id,
        Some(&revoked),
        Some(7),
        MAX_ISSUED_CREDENTIALS,
        assertion(),
        Some(&service()),
        NOW,
    )
    .unwrap();
    assert_eq!(renewal.retained_count, MAX_ISSUED_CREDENTIALS);
    assert_eq!(
        issue_credential(
            &existing.issuer_id,
            FixedBytes([2; 32]),
            None,
            None,
            MAX_ISSUED_CREDENTIALS - 1,
            assertion(),
            Some(&service()),
            NOW
        )
        .unwrap()
        .retained_count,
        MAX_ISSUED_CREDENTIALS
    );
}

#[test]
fn registry_assertions_reject_missing_inactive_wrong_subject_and_changed_version() {
    let value = assertion();
    assert_eq!(
        issue_credential(
            &account("issuer.testnet"),
            FixedBytes([1; 32]),
            None,
            None,
            0,
            value.clone(),
            None,
            NOW
        ),
        Err(RegistryError::InvalidSubject)
    );
    let mut inactive = service();
    inactive.active = false;
    assert_eq!(
        issue_credential(
            &account("issuer.testnet"),
            FixedBytes([1; 32]),
            None,
            None,
            0,
            value,
            Some(&inactive),
            NOW
        ),
        Err(RegistryError::InvalidSubject)
    );
    let mut wrong = assertion();
    wrong.service_id = account("other.testnet");
    assert_eq!(issue(wrong), Err(RegistryError::InvalidSubject));
    let mut stale = assertion();
    stale.service_version = 2;
    assert_eq!(issue(stale), Err(RegistryError::InvalidSubject));
}

#[test]
fn registry_assertions_reject_wrong_scope_and_invalid_suite_version() {
    for (namespace, version) in [
        ("other.capability", 1),
        ("invoice.audit.v1", 1),
        ("invoice.audit", 0),
        ("invoice.audit", 2),
    ] {
        let mut wrong = assertion();
        wrong.capability_namespace = namespace.into();
        wrong.capability_version = version;
        assert_eq!(issue(wrong), Err(RegistryError::InvalidScope));
    }
    let mut wrong = assertion();
    wrong.conformance_suite_version = 0;
    assert_eq!(issue(wrong), Err(RegistryError::InvalidSuite));
}

#[test]
fn registry_dates_enforce_expiry_order_and_exact_clock_skew_boundary() {
    let mut value = assertion();
    value.issued_at_ns = U64String(NOW + CREDENTIAL_CLOCK_SKEW_NS);
    assert!(credential_dates_valid(&value, NOW));
    assert!(issue(value.clone()).is_ok());
    value.issued_at_ns.0 += 1;
    assert!(!credential_dates_valid(&value, NOW));
    assert_eq!(issue(value), Err(RegistryError::InvalidDates));
    for (issued, expires) in [
        (NOW, NOW),
        (NOW + 1, NOW),
        (NOW - 2, NOW - 1),
        (NOW - 1, NOW),
    ] {
        let mut invalid = assertion();
        invalid.issued_at_ns = U64String(issued);
        invalid.expires_at_ns = U64String(expires);
        assert_eq!(issue(invalid), Err(RegistryError::InvalidDates));
    }
    let mut bounded = assertion();
    bounded.expires_at_ns = U64String(u64::MAX);
    assert!(credential_dates_valid(&bounded, NOW));
    assert!(!credential_dates_valid(&bounded, u64::MAX));
}

#[test]
fn registry_mutations_do_not_grant_owner_policy_or_other_tenant_credit() {
    let mut payer = ActorState::new(account("issuer.testnet"));
    payer.ledger.available_yocto = U128String(1000);
    payer.ledger.storage_credit_yocto = U128String(10);
    let mut other = ActorState::new(account("other.testnet"));
    other.ledger.storage_credit_yocto = U128String(1000);
    let before_payer = payer.clone();
    let before_other = other.clone();
    let record = issue(assertion()).unwrap();
    let bytes = borsh::to_vec(&record.credential).unwrap().len() as u64;
    assert!(bytes > 10);
    assert_eq!(
        charge_actor_storage(
            &payer,
            AggregateLiabilities {
                available_yocto: 1000,
                storage_credit_yocto: 1010
            },
            bytes,
            1
        ),
        Err(AuthorityError::StorageCredit)
    );
    assert_eq!(payer, before_payer);
    assert_eq!(other, before_other);
    assert!(payer.policy.paused);
    assert_eq!(payer.policy.revision, 0);
    assert!(payer.profiles.is_empty());
}

#[test]
fn registry_json_binds_exact_assertion_shape_and_fixed_byte_lengths() {
    // An actual transition must accept the canonical DTO before parser-negative checks.
    assert!(issue(assertion()).is_ok());
    let canonical = serde_json::to_value(assertion()).unwrap();
    assert!(serde_json::from_value::<CredentialAssertion>(canonical.clone()).is_ok());
    for field in ["conformance_suite_hash", "evidence_manifest_hash"] {
        let mut wrong = canonical.clone();
        wrong[field] = serde_json::json!("AA==");
        assert!(serde_json::from_value::<CredentialAssertion>(wrong).is_err());
    }
    let mut extra = canonical;
    extra["owner_approval"] = serde_json::json!(true);
    assert!(serde_json::from_value::<CredentialAssertion>(extra).is_err());
}
