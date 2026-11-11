use agenttrust_domain::authority::{AuthorityError, authorize_callback};

#[test]
fn private_callback_requires_actual_self_predecessor() {
    let core = "core.testnet".parse().unwrap();
    for caller in [
        "owner.testnet",
        "merchant.testnet",
        "relay.testnet",
        "core.other.testnet",
    ] {
        assert_eq!(
            authorize_callback(&core, &caller.parse().unwrap(), 1),
            Err(AuthorityError::Unauthorized)
        );
    }
    assert_eq!(authorize_callback(&core, &core, 1), Ok(()));
}

#[test]
fn missing_or_multiple_results_cannot_be_treated_as_definitive_transfer_failure() {
    let core = "core.testnet".parse().unwrap();
    for count in [0, 2, 3, u64::MAX] {
        assert_eq!(
            authorize_callback(&core, &core, count),
            Err(AuthorityError::Unauthorized)
        );
    }
    assert_eq!(authorize_callback(&core, &core, 1), Ok(()));
}
