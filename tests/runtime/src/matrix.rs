//! Additional USER-RUN ONLY native scenarios. This module never substitutes a
//! mock callback, patched contract state or a pure snapshot for a real receipt.
use super::*;

const SECOND: u64 = 1_000_000_000;
const MINUTE: u64 = 60 * SECOND;

pub(super) fn actor_state(account: &Value) -> Value {
    // The shared vault includes gas rewards and other actors; compare only the
    // actor's persisted financial and usage fields for no-write assertions.
    json!({"available":account["available_yocto"],"storage":account["storage_credit_yocto"],
        "pending":account["pending_payment_yocto"],"charged":account["storage_charged_bytes"],
        "usage":account["usage"]})
}
fn panic_code(raw: &Value, code: &str) -> bool {
    !success(raw)
        && failures(raw).iter().any(|receipt| {
            receipt["outcome"]["status"]["Failure"]["ActionError"]["kind"]["FunctionCallError"]
            ["ExecutionError"].as_str()
            .is_some_and(|error| error == format!("Smart contract panicked: {code}"))
        })
}
async fn denied_without_record(
    h: &mut Harness,
    core: &AccountId,
    buyer: &Fixture,
    quote: &Value,
    credential: Value,
    code: &str,
) -> Result<bool> {
    let before = ledger(h, core, buyer).await?;
    let raw = h
        .call(
            "matrix-denial",
            buyer
                .worker
                .call(core, "execute_payment")
                .args_json(json!({"quote":quote,"credential":credential})),
        )
        .await?;
    let record = h
        .view(
            core,
            "get_payment",
            json!({"owner_id":buyer.owner.id(),
        "payment_id":quote["invoice"]["payment_id"]}),
        )
        .await?;
    let after = ledger(h, core, buyer).await?;
    Ok(rejection(&raw, code) && record.is_null() && actor_state(&before) == actor_state(&after))
}
async fn execution_timestamp(h: &mut Harness, core: &AccountId, raw: &Value) -> Result<u64> {
    // Bind to the initial direct function-call receipt, not a later callback or
    // refund. Rejected calls have no PaymentRecord, so their execution block is
    // essential to establish that the sixth request used the same minute.
    let receipt_id = raw["result"]["transaction_outcome"]["outcome"]["status"]["SuccessReceiptId"]
        .as_str()
        .context("missing initial execution receipt")?;
    let receipt = raw["result"]["receipts_outcome"]
        .as_array()
        .context("receipt outcomes")?
        .iter()
        .find(|receipt| receipt["id"] == receipt_id)
        .context("initial execution receipt missing from FINAL outcome")?;
    ensure!(
        receipt["outcome"]["executor_id"] == core.as_str(),
        "initial receipt did not execute in core"
    );
    let block_hash = receipt["block_hash"]
        .as_str()
        .context("execution receipt block hash")?;
    let request = json!({"block_id":block_hash});
    let response = h.rpc("block", request.clone()).await?;
    h.artifact(
        "core-execution-block",
        "execution_block",
        &json!({
            "transaction_hash":raw["result"]["transaction"]["hash"],"receipt_id":receipt_id,
            "request":request,"response":response,
        }),
    )?;
    ensure!(
        response.get("error").is_none() && response["result"]["header"]["hash"] == block_hash,
        "execution block response did not match receipt block"
    );
    u64::try_from(decimal(&response["result"]["header"]["timestamp_nanosec"])?)
        .context("block timestamp range")
}
async fn advance_past(h: &mut Harness, timestamp: u64) -> Result<()> {
    // Sandbox block-time acceleration is confined to the user-run binary. Check
    // the observed timestamp; never assume a particular seconds-per-block value.
    for _ in 0..8 {
        if h.timestamp().await? > timestamp {
            return Ok(());
        }
        h.worker.fast_forward(100).await?;
    }
    bail!("Sandbox clock did not pass the requested scenario timestamp")
}
async fn policy_args(h: &mut Harness, core: &AccountId, buyer: &Fixture) -> Result<Value> {
    let p = h
        .view(core, "get_policy", json!({"owner_id":buyer.owner.id()}))
        .await?;
    Ok(
        json!({"expected_revision":p["revision"],"daily_cap_yocto":p["daily_cap_yocto"],
        "max_dispatches_per_minute":p["max_dispatches_per_minute"],"paused":p["paused"]}),
    )
}
fn resign(
    mut quote: Value,
    key: &near_crypto::SecretKey,
    field: &str,
    value: Value,
) -> Result<Value> {
    quote["invoice"][field] = value;
    signed(serde_json::from_value(quote["invoice"].clone())?, key)
}

pub(super) async fn run(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
) -> Result<()> {
    authority_changes(h, core, merchant, key).await?;
    exact_limits(h, core, merchant, key).await?;
    minute_rate(h, core, merchant, key).await?;
    trust_changes(h, core, key, recipient).await?;
    credential_changes(h, core, merchant, key, recipient).await?;
    capacity_and_storage(h, core, merchant, key).await?;
    Ok(())
}

async fn authority_changes(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
) -> Result<()> {
    let start = h.start();
    let revoked = owner(h, "revoked", core, merchant, 60, NEAR).await?;
    h.manage(
        &revoked.owner,
        core,
        "revoke_session",
        json!({"session_id":revoked.session_id}),
    )
    .await?;
    let q = quote(h, core, &revoked, merchant, key, 60, 1).await?;
    let revoked_denied =
        denied_without_record(h, core, &revoked, &q, Value::Null, "SESSION_REVOKED").await?;

    let mut setup = OwnerSetup::standard(NEAR);
    setup.session_lifetime_ns = 30 * SECOND;
    let expired = owner_with(h, "expired", core, merchant, 61, setup).await?;
    let session = h
        .view(
            core,
            "get_session",
            json!({"owner_id":expired.owner.id(),"session_id":expired.session_id}),
        )
        .await?;
    advance_past(h, decimal(&session["expires_at_ns"])? as u64).await?;
    let q = quote(h, core, &expired, merchant, key, 61, 1).await?;
    let expired_denied =
        denied_without_record(h, core, &expired, &q, Value::Null, "SESSION_EXPIRED").await?;

    let profile = owner(h, "profiles", core, merchant, 62, NEAR).await?;
    // A worker cannot manufacture management authority even with a full-access
    // owner key: the missing one-yocto deposit must still fail at the boundary.
    let before = h
        .view(core, "get_policy", json!({"owner_id":profile.owner.id()}))
        .await?;
    let args = policy_args(h, core, &profile).await?;
    let zero = h
        .call(
            "zero-deposit-management",
            profile.owner.call(core, "set_policy").args_json(args),
        )
        .await?;
    let after = h
        .view(core, "get_policy", json!({"owner_id":profile.owner.id()}))
        .await?;
    h.manage(
        &profile.owner,
        core,
        "set_profile",
        json!({"profile_id":"weaker","expected_revision":null,"requirement":null}),
    )
    .await?;
    let q = quote(h, core, &profile, merchant, key, 62, 1).await?;
    let weaker = resign(q, key, "profile_id", json!("weaker"))?;
    let weaker_denied =
        denied_without_record(h, core, &profile, &weaker, Value::Null, "PROFILE_MISMATCH").await?;
    h.manage(
        &profile.owner,
        core,
        "set_profile",
        json!({"profile_id":"audit","expected_revision":1,"requirement":null}),
    )
    .await?;
    let old = quote(h, core, &profile, merchant, key, 63, 1).await?;
    let old_denied =
        denied_without_record(h, core, &profile, &old, Value::Null, "PROFILE_MISMATCH").await?;
    let upgraded = resign(old, key, "profile_revision", json!(2))?;
    let upgraded_denied = denied_without_record(
        h,
        core,
        &profile,
        &upgraded,
        Value::Null,
        "PROFILE_MISMATCH",
    )
    .await?;
    h.case(
        "session_and_profile_changes",
        start,
        vec![
            (
                "revoked actual worker cannot allocate or charge",
                revoked_denied,
            ),
            (
                "expired actual worker cannot allocate or charge",
                expired_denied,
            ),
            (
                "zero-deposit owner management rejects without mutation",
                panic_code(&zero, "UNAUTHORIZED") && before == after,
            ),
            ("worker cannot select another profile", weaker_denied),
            ("profile edit invalidates old session revision", old_denied),
            (
                "worker cannot self-upgrade its pinned revision",
                upgraded_denied,
            ),
        ],
        &["A real relayed predecessor is covered by the separate optional forwarding-helper case."],
    );
    Ok(())
}

async fn exact_limits(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
) -> Result<()> {
    let start = h.start();
    let buyer = owner(h, "exactcap", core, merchant, 64, NEAR / 10).await?;
    let q = quote(h, core, &buyer, merchant, key, 64, NEAR / 10).await?;
    let before = ledger(h, core, &buyer).await?;
    let mut previews_allow = true;
    for _ in 0..3 {
        let preview = h
            .view(
                core,
                "preview_payment",
                json!({"quote":q,"credential":null}),
            )
            .await?;
        previews_allow &= preview["decision"]["kind"] == "allow"
            && preview["authorization"] == "not_proven_by_view";
    }
    let after_preview = ledger(h, core, &buyer).await?;
    let preview_record = payment(h, core, &buyer, 64).await?;
    let too_large = quote(h, core, &buyer, merchant, key, 65, NEAR / 10 + 1).await?;
    let purchase_denied =
        denied_without_record(h, core, &buyer, &too_large, Value::Null, "PURCHASE_CAP").await?;
    let paid = pay(h, core, &buyer, &q, "exact-purchase-and-day-cap").await?;
    let settled = payment(h, core, &buyer, 64).await?;
    let after = ledger(h, core, &buyer).await?;
    let over_day = quote(h, core, &buyer, merchant, key, 66, 1).await?;
    let day_denied =
        denied_without_record(h, core, &buyer, &over_day, Value::Null, "DAILY_CAP").await?;
    let replay = pay(h, core, &buyer, &q, "exact-cap-replay").await?;
    let replayed = ledger(h, core, &buyer).await?;
    h.case(
        "exact_limits_and_preview",
        start,
        vec![
            (
                "three allowed previews allocate and charge nothing",
                previews_allow
                    && preview_record.is_null()
                    && actor_state(&before) == actor_state(&after_preview),
            ),
            (
                "purchase cap plus one yocto denied without charge",
                purchase_denied,
            ),
            (
                "exact purchase and day cap settle",
                success(&paid) && failures(&paid).is_empty() && settled["state"] == "settled",
            ),
            (
                "exact amount and one attempt charged",
                decimal(&before["available_yocto"])?
                    .checked_sub(decimal(&after["available_yocto"])?)
                    == Some(NEAR / 10)
                    && after["usage"]["dispatched_in_minute"] == 1,
            ),
            ("day cap plus one yocto denied without charge", day_denied),
            (
                "replay does not charge another attempt",
                returned(&replay)?["duplicate"] == true
                    && actor_state(&after) == actor_state(&replayed),
            ),
        ],
        &[],
    );
    Ok(())
}

async fn minute_rate(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
) -> Result<()> {
    let start = h.start();
    let buyer = owner(h, "minute", core, merchant, 70, NEAR).await?;
    let mut workers = vec![buyer.worker.clone()];
    for n in 1..6 {
        let worker_key = SecretKey::from_random(KeyType::ED25519);
        let now = h.timestamp().await?;
        h.manage(&buyer.owner, core, "register_session", json!({"session_id":id(70+n),"public_key":worker_key.public_key().to_string(),"profile_id":"audit","profile_revision":1,"purchase_cap_yocto":(NEAR/10).to_string(),"expires_at_ns":(now+86_400_000_000_000u64).to_string()})).await?;
        let tx = buyer
            .owner
            .batch(buyer.owner.id())
            .add_key(
                worker_key.public_key(),
                AccessKey::function_call_access(
                    core,
                    &["execute_payment"],
                    Some(STANDARD_WORKER_ALLOWANCE),
                ),
            )
            .transact_async()
            .await?;
        ensure!(
            success(&h.final_tx("rate-worker-key", tx).await?),
            "rate key installation failed"
        );
        workers.push(Account::from_secret_key(
            buyer.owner.id().clone(),
            worker_key,
            &h.worker,
        ));
    }
    // Leave room for admission receipts; actual dispatch timestamps below must
    // prove all accepted requests hit one fixed window, or this case fails.
    for _ in 0..4 {
        if h.timestamp().await? % MINUTE < 30 * SECOND {
            break;
        }
        h.worker.fast_forward(40).await?;
    }
    let mut submitted = Vec::new();
    let mut quotes = Vec::new();
    for (index, worker) in workers.iter().enumerate() {
        let fixture = Fixture {
            owner: buyer.owner.clone(),
            worker: worker.clone(),
            session_id: id(70 + index as u8),
        };
        let q = quote(
            h,
            core,
            &fixture,
            merchant,
            key,
            70 + index as u8,
            NEAR / 10_000,
        )
        .await?;
        quotes.push(q.clone());
        submitted.push(
            worker
                .call(core, "execute_payment")
                .args_json(json!({"quote":q,"credential":null}))
                .gas(RUNTIME_CALL_GAS)
                .transact_async()
                .await?,
        );
    }
    let mut accepted = 0;
    let mut rejected = 0;
    let mut dispatch_minutes = std::collections::BTreeSet::new();
    let mut execution_minutes = std::collections::BTreeSet::new();
    let mut accepted_index = None;
    for (index, pending) in submitted.into_iter().enumerate() {
        let raw = h.final_tx("fixed-window-request", pending).await?;
        execution_minutes.insert(u128::from(
            execution_timestamp(h, core, &raw).await? / MINUTE,
        ));
        let record = payment(h, core, &buyer, 70 + index as u8).await?;
        if record["state"] == "settled" && success(&raw) && failures(&raw).is_empty() {
            accepted += 1;
            accepted_index = Some(index);
            dispatch_minutes.insert(decimal(&record["dispatched_at_ns"])? / u128::from(MINUTE));
        }
        if rejection(&raw, "RATE_LIMIT") && record.is_null() {
            rejected += 1;
        }
    }
    let after = ledger(h, core, &buyer).await?;
    let mut replay_uncharged = false;
    if let Some(index) = accepted_index {
        let fixture = Fixture {
            owner: buyer.owner.clone(),
            worker: workers[index].clone(),
            session_id: id(70 + index as u8),
        };
        let replay = pay(h, core, &fixture, &quotes[index], "rate-window-replay").await?;
        replay_uncharged = returned(&replay)?["duplicate"] == true
            && actor_state(&after) == actor_state(&ledger(h, core, &buyer).await?);
    }
    h.case("fixed_minute_rate", start, vec![
        ("five requests settle and sixth receives rate limit", accepted == 5 && rejected == 1),
        ("all six core calls including rejection execute in one measured minute", execution_minutes.len() == 1),
        ("accepted dispatch timestamps match that execution minute", dispatch_minutes == execution_minutes),
        ("owner-wide counter records exactly five attempts", after["usage"]["dispatched_in_minute"] == 5 && after["usage"]["retained_payments"] == 5),
        ("exact replay does not consume a sixth attempt", replay_uncharged),
    ], &["If admission receipts straddle a minute this case fails; the runner never relabels a split window as proof of the five-per-minute boundary."]);
    Ok(())
}

fn public_key(key: &near_crypto::SecretKey) -> Result<String> {
    Ok(STANDARD.encode(
        bs58::decode(
            key.public_key()
                .to_string()
                .split_once(':')
                .context("key encoding")?
                .1,
        )
        .into_vec()?,
    ))
}
async fn set_service(
    h: &mut Harness,
    core: &AccountId,
    merchant: &Account,
    version: Option<u32>,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
    endpoint: u8,
) -> Result<()> {
    h.manage(merchant, core, "set_service", json!({"expected_version":version,"payout_account":recipient,"invoice_key":public_key(key)?,"endpoint_hash":id(endpoint),"active":true})).await?;
    Ok(())
}
async fn trust(
    h: &mut Harness,
    core: &AccountId,
    buyer: &Fixture,
    merchant: &AccountId,
    version: u32,
    active: bool,
) -> Result<()> {
    h.manage(&buyer.owner, core, "set_service_trust", json!({"service_id":merchant,"service_version":version,"allowed_profile_ids":["audit"],"expires_at_ns":null,"active":active})).await?;
    Ok(())
}
async fn trust_changes(
    h: &mut Harness,
    core: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
) -> Result<()> {
    let start = h.start();
    let merchant = actor(h, "mutablemerchant", core, NEAR / 4).await?;
    set_service(h, core, &merchant, None, key, recipient, 77).await?;
    let buyer = owner(h, "trustchanges", core, merchant.id(), 80, NEAR).await?;
    h.manage(
        &buyer.owner,
        core,
        "block_service",
        json!({"service_id":merchant.id(),"blocked":true}),
    )
    .await?;
    let q = quote(h, core, &buyer, merchant.id(), key, 80, 1).await?;
    let service_block =
        denied_without_record(h, core, &buyer, &q, Value::Null, "BLOCKED_SERVICE").await?;
    h.manage(
        &buyer.owner,
        core,
        "block_service",
        json!({"service_id":merchant.id(),"blocked":false}),
    )
    .await?;
    h.manage(
        &buyer.owner,
        core,
        "block_payout",
        json!({"payout_account":recipient,"blocked":true}),
    )
    .await?;
    let q = quote(h, core, &buyer, merchant.id(), key, 81, 1).await?;
    let payout_block =
        denied_without_record(h, core, &buyer, &q, Value::Null, "BLOCKED_PAYOUT").await?;
    h.manage(
        &buyer.owner,
        core,
        "block_payout",
        json!({"payout_account":recipient,"blocked":false}),
    )
    .await?;
    trust(h, core, &buyer, merchant.id(), 1, false).await?;
    let q = quote(h, core, &buyer, merchant.id(), key, 82, 1).await?;
    let inactive =
        denied_without_record(h, core, &buyer, &q, Value::Null, "UNKNOWN_SERVICE").await?;
    trust(h, core, &buyer, merchant.id(), 1, true).await?;
    let old = quote(h, core, &buyer, merchant.id(), key, 83, 1).await?;
    set_service(h, core, &merchant, Some(1), key, recipient, 78).await?;
    let stale_invoice =
        denied_without_record(h, core, &buyer, &old, Value::Null, "IDENTITY_CHANGED").await?;
    let new = quote(h, core, &buyer, merchant.id(), key, 84, 1).await?;
    let stale_trust =
        denied_without_record(h, core, &buyer, &new, Value::Null, "IDENTITY_CHANGED").await?;
    trust(h, core, &buyer, merchant.id(), 2, true).await?;
    // Rotate the registered invoice key without reusing its old approval.
    let rotated = near_crypto::SecretKey::from_random(near_crypto::KeyType::ED25519);
    set_service(h, core, &merchant, Some(2), &rotated, recipient, 78).await?;
    let bad_signature = quote(h, core, &buyer, merchant.id(), key, 85, 1).await?;
    let old_key = denied_without_record(
        h,
        core,
        &buyer,
        &bad_signature,
        Value::Null,
        "INVALID_INVOICE",
    )
    .await?;
    let rotated_quote = quote(h, core, &buyer, merchant.id(), &rotated, 86, 1).await?;
    let key_trust = denied_without_record(
        h,
        core,
        &buyer,
        &rotated_quote,
        Value::Null,
        "IDENTITY_CHANGED",
    )
    .await?;
    trust(h, core, &buyer, merchant.id(), 3, true).await?;
    // Payout mutation is independently denied even with a valid current key.
    set_service(h, core, &merchant, Some(3), &rotated, merchant.id(), 78).await?;
    let payout_quote = quote(h, core, &buyer, merchant.id(), &rotated, 87, 1).await?;
    let payout_trust = denied_without_record(
        h,
        core,
        &buyer,
        &payout_quote,
        Value::Null,
        "IDENTITY_CHANGED",
    )
    .await?;
    trust(h, core, &buyer, merchant.id(), 4, true).await?;
    let permitted = quote(h, core, &buyer, merchant.id(), &rotated, 88, 1).await?;
    let paid = pay(h, core, &buyer, &permitted, "explicit-refreshed-trust").await?;
    let settled = payment(h, core, &buyer, 88).await?;
    h.case(
        "trust_and_identity_changes",
        start,
        vec![
            ("service block overrides exact active trust", service_block),
            ("payout block overrides exact active trust", payout_block),
            ("inactive trust provides no automatic trial", inactive),
            (
                "old invoice invalid after endpoint/version mutation",
                stale_invoice,
            ),
            ("new endpoint needs renewed exact trust", stale_trust),
            ("old signing key is rejected after rotation", old_key),
            ("new key needs renewed exact trust", key_trust),
            ("new payout needs renewed exact trust", payout_trust),
            (
                "explicit exact approval restores one valid dispatch",
                success(&paid) && failures(&paid).is_empty() && settled["state"] == "settled",
            ),
        ],
        &[],
    );
    Ok(())
}

async fn credential_changes(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
) -> Result<()> {
    let start = h.start();
    let issuer = actor(h, "validator", core, NEAR / 4).await?;
    let other = actor(h, "otherservice", core, NEAR / 4).await?;
    set_service(h, core, &other, None, key, recipient, 77).await?;
    let requirement = json!({"capability_namespace":"invoice.audit","capability_version":1,"conformance_suite_version":1,"conformance_suite_hash":id(90),"accepted_issuers":[issuer.id()]});
    let mut setup = OwnerSetup::standard(NEAR);
    setup.requirement = requirement.clone();
    let buyer = owner_with(h, "credentials", core, merchant, 90, setup).await?;
    let q = quote(h, core, &buyer, merchant, key, 90, 1).await?;
    let missing = denied_without_record(h, core, &buyer, &q, Value::Null, "MISSING").await?;
    let now = h.timestamp().await?;
    let assertion = json!({"service_id":merchant,"service_version":1,"capability_namespace":"invoice.audit","capability_version":1,"conformance_suite_version":1,"conformance_suite_hash":id(90),"evidence_manifest_hash":id(91),"issued_at_ns":now.to_string(),"expires_at_ns":(now+3600*SECOND).to_string()});
    h.manage(
        &issuer,
        core,
        "issue_credential",
        json!({"credential_id":id(90),"expected_revision":null,"assertion":assertion}),
    )
    .await?;
    let reference = json!({"issuer_id":issuer.id(),"credential_id":id(90),"revision":1});
    let unaccepted = json!({"issuer_id":merchant,"credential_id":id(90),"revision":1});
    let unaccepted_denied =
        denied_without_record(h, core, &buyer, &q, unaccepted, "UNACCEPTED_ISSUER").await?;
    let mut wrong_subject = assertion.clone();
    wrong_subject["service_id"] = json!(other.id());
    h.manage(
        &issuer,
        core,
        "issue_credential",
        json!({"credential_id":id(91),"expected_revision":null,"assertion":wrong_subject}),
    )
    .await?;
    let subject = denied_without_record(
        h,
        core,
        &buyer,
        &q,
        json!({"issuer_id":issuer.id(),"credential_id":id(91),"revision":1}),
        "WRONG_SUBJECT",
    )
    .await?;
    let mut wrong_suite = assertion.clone();
    wrong_suite["conformance_suite_hash"] = json!(id(92));
    h.manage(
        &issuer,
        core,
        "issue_credential",
        json!({"credential_id":id(92),"expected_revision":null,"assertion":wrong_suite}),
    )
    .await?;
    let suite = denied_without_record(
        h,
        core,
        &buyer,
        &q,
        json!({"issuer_id":issuer.id(),"credential_id":id(92),"revision":1}),
        "WRONG_SUITE",
    )
    .await?;
    let mut wrong_scope = assertion.clone();
    wrong_scope["capability_version"] = json!(2);
    let invalid_scope = h.call("invalid-credential-scope", issuer.call(core, "issue_credential").args_json(json!({"credential_id":id(93),"expected_revision":null,"assertion":wrong_scope})).deposit(NearToken::from_yoctonear(1))).await?;
    let missing_scope = h
        .view(
            core,
            "get_credential",
            json!({"issuer_id":issuer.id(),"credential_id":id(93)}),
        )
        .await?;
    let mut empty_requirement = requirement;
    empty_requirement["accepted_issuers"] = json!([]);
    let invalid_profile = h.call("empty-required-issuers", buyer.owner.call(core, "set_profile").args_json(json!({"profile_id":"audit","expected_revision":1,"requirement":empty_requirement})).deposit(NearToken::from_yoctonear(1))).await?;
    let profile = h
        .view(
            core,
            "get_profile",
            json!({"owner_id":buyer.owner.id(),"profile_id":"audit"}),
        )
        .await?;
    h.manage(
        &issuer,
        core,
        "issue_credential",
        json!({"credential_id":id(90),"expected_revision":1,"assertion":assertion}),
    )
    .await?;
    let stale_revision =
        denied_without_record(h, core, &buyer, &q, reference, "REVISION_CHANGED").await?;
    let current = json!({"issuer_id":issuer.id(),"credential_id":id(90),"revision":2});
    // Refresh the quote after the preceding native receipts, keeping expiry out
    // of the positive-control assertion.
    let q = quote(h, core, &buyer, merchant, key, 90, 1).await?;
    let paid = h
        .call(
            "accepted-credential",
            buyer
                .worker
                .call(core, "execute_payment")
                .args_json(json!({"quote":q,"credential":current})),
        )
        .await?;
    let settled = payment(h, core, &buyer, 90).await?;
    h.manage(
        &issuer,
        core,
        "revoke_credential",
        json!({"credential_id":id(90)}),
    )
    .await?;
    let revoked_quote = quote(h, core, &buyer, merchant, key, 94, 1).await?;
    let revoked =
        denied_without_record(h, core, &buyer, &revoked_quote, current.clone(), "REVOKED").await?;
    let replay_before = ledger(h, core, &buyer).await?;
    let payment_before_replay = payment(h, core, &buyer, 90).await?;
    let recipient_before_replay = h.balance(recipient).await?;
    let replay = h
        .call(
            "settled-replay-after-revocation",
            buyer
                .worker
                .call(core, "execute_payment")
                .args_json(json!({"quote":q,"credential":current})),
        )
        .await?;
    let replay_after = ledger(h, core, &buyer).await?;
    let payment_after_replay = payment(h, core, &buyer, 90).await?;
    let recipient_after_replay = h.balance(recipient).await?;
    let now = h.timestamp().await?;
    let mut short = assertion;
    short["issued_at_ns"] = json!(now.to_string());
    short["expires_at_ns"] = json!((now + 30 * SECOND).to_string());
    h.manage(
        &issuer,
        core,
        "issue_credential",
        json!({"credential_id":id(95),"expected_revision":null,"assertion":short}),
    )
    .await?;
    advance_past(h, now + 30 * SECOND).await?;
    let qexpired = quote(h, core, &buyer, merchant, key, 95, 1).await?;
    let expired = denied_without_record(
        h,
        core,
        &buyer,
        &qexpired,
        json!({"issuer_id":issuer.id(),"credential_id":id(95),"revision":1}),
        "EXPIRED",
    )
    .await?;
    h.case("credential_changes", start, vec![
        ("missing required credential does not dispatch", missing),
        ("trusted merchant is not implicitly an accepted issuer", unaccepted_denied),
        ("other service subject cannot satisfy requirement", subject),
        ("different conformance suite cannot satisfy requirement", suite),
        ("registry rejects unsupported scope without allocating credential", panic_code(&invalid_scope, "INVALID_SCOPE") && missing_scope.is_null()),
        ("empty required issuer set rejects without profile mutation", panic_code(&invalid_profile, "INVALID_PROFILE") && profile["revision"] == 1),
        ("old assertion revision rejects after renewal", stale_revision),
        ("current accepted credential permits settlement", success(&paid) && failures(&paid).is_empty() && settled["state"] == "settled"),
        ("revocation prevents a fresh payment", revoked),
        ("expiry prevents a fresh payment", expired),
        ("settled replay after revocation does not charge again", returned(&replay)?["duplicate"] == true && actor_state(&replay_before) == actor_state(&replay_after)),
        ("revocation and replay preserve the entire original payment", settled == payment_before_replay && settled == payment_after_replay && returned(&replay)?["payment"] == settled),
        ("settled replay after revocation pays no additional amount", recipient_before_replay["amount"] == recipient_after_replay["amount"]),
    ], &["Wrong-scope assertions cannot be issued through the production ABI; this case proves registry rejection, not an artificially injected corrupt credential."]);
    Ok(())
}

async fn capacity_and_storage(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
) -> Result<()> {
    let start = h.start();
    // Identical-length account names keep the initial state-size estimate close;
    // the observed credit below, not that estimate, establishes payment denial.
    let probe = owner(h, "storageprobe", core, merchant, 100, NEAR).await?;
    let observed = ledger(h, core, &probe).await?;
    let byte_cost = decimal(&observed["vault"]["storage_byte_cost_yocto"])?;
    let setup_cost = decimal(&observed["storage_charged_bytes"])? * byte_cost;
    let mut setup = OwnerSetup::standard(NEAR);
    setup.storage = setup_cost + 128 * byte_cost;
    let tight = owner_with(h, "storagetight", core, merchant, 101, setup).await?;
    let q = quote(h, core, &tight, merchant, key, 101, 1).await?;
    let tight_ledger = ledger(h, core, &tight).await?;
    let required = agenttrust_domain::payments::payment_storage_bound(
        &serde_json::from_value(q.clone())?,
        None,
    );
    let low_credit =
        decimal(&tight_ledger["storage_credit_yocto"])? < u128::from(required) * byte_cost;
    let denied = denied_without_record(h, core, &tight, &q, Value::Null, "STORAGE_CREDIT").await?;
    let probe_after = ledger(h, core, &probe).await?;
    // Real funding with zero storage credit must roll back actor creation.
    let empty = h
        .worker
        .root_account()?
        .create_subaccount("zerostorage")
        .initial_balance(NearToken::from_near(2))
        .transact()
        .await?
        .into_result()?;
    h.actor("zero-storage-credit", &empty);
    let unfunded = h
        .call(
            "zero-storage-deposit",
            empty
                .call(core, "deposit")
                .args_json(json!({"storage_credit_yocto":"0"}))
                .deposit(NearToken::from_near(1)),
        )
        .await?;
    let absent = h
        .view(core, "get_account", json!({"account_id":empty.id()}))
        .await?;
    let bounded = owner(h, "capacity", core, merchant, 102, NEAR).await?;
    h.manage(
        &bounded.owner,
        core,
        "revoke_session",
        json!({"session_id":bounded.session_id}),
    )
    .await?;
    for n in 1..8 {
        let now = h.timestamp().await?;
        h.manage(&bounded.owner, core, "register_session", json!({"session_id":id(102+n),"public_key":SecretKey::from_random(KeyType::ED25519).public_key().to_string(),"profile_id":"audit","profile_revision":1,"purchase_cap_yocto":"1","expires_at_ns":(now+3600*SECOND).to_string()})).await?;
    }
    let now = h.timestamp().await?;
    let overflow = h.call("ninth-retained-session", bounded.owner.call(core, "register_session").args_json(json!({"session_id":id(110),"public_key":SecretKey::from_random(KeyType::ED25519).public_key().to_string(),"profile_id":"audit","profile_revision":1,"purchase_cap_yocto":"1","expires_at_ns":(now+3600*SECOND).to_string()})).deposit(NearToken::from_yoctonear(1))).await?;
    let ninth = h
        .view(
            core,
            "get_session",
            json!({"owner_id":bounded.owner.id(),"session_id":id(110)}),
        )
        .await?;
    for profile in ["second", "third", "fourth"] {
        h.manage(
            &bounded.owner,
            core,
            "set_profile",
            json!({"profile_id":profile,"expected_revision":null,"requirement":null}),
        )
        .await?;
    }
    let fifth = h
        .call(
            "fifth-retained-profile",
            bounded
                .owner
                .call(core, "set_profile")
                .args_json(
                    json!({"profile_id":"fifth","expected_revision":null,"requirement":null}),
                )
                .deposit(NearToken::from_yoctonear(1)),
        )
        .await?;
    let fifth_view = h
        .view(
            core,
            "get_profile",
            json!({"owner_id":bounded.owner.id(),"profile_id":"fifth"}),
        )
        .await?;
    h.case("actor_capacity_and_storage", start, vec![
        ("observed unused credit below payment storage bound", low_credit),
        ("underfunded payment rejects without record or charge", denied),
        ("one actor cannot consume another actor storage credit", actor_state(&observed) == actor_state(&probe_after)),
        ("zero-credit actor creation rolls back on storage failure", panic_code(&unfunded, "STORAGE_CREDIT") && absent.is_null()),
        ("revoked sessions still count toward eight-record bound", panic_code(&overflow, "CAPACITY") && ninth.is_null()),
        ("fifth profile rejects without creating a record", panic_code(&fifth, "CAPACITY") && fifth_view.is_null()),
    ], &["Outstanding-transfer and 128-retained-payment limits are exercised separately by transfer_capacity; these configuration/storage checks alone do not establish those limits."]);
    Ok(())
}

pub(super) async fn retained_capacity(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
) -> Result<(usize, Vec<(&'static str, bool)>)> {
    let start = h.start();
    let mut setup = OwnerSetup::standard(NEAR);
    // This isolated fixture funds the measured storage of 128 real records and
    // a finite worker gas allowance. It does not change product defaults.
    setup.storage = 4 * NEAR;
    setup.worker_allowance = NearToken::from_near(1);
    let buyer = owner_with(h, "retainedlimit", core, merchant, 120, setup).await?;
    let mut args = policy_args(h, core, &buyer).await?;
    args["max_dispatches_per_minute"] = json!(256);
    h.manage(&buyer.owner, core, "set_policy", args).await?;
    let before = ledger(h, core, &buyer).await?;
    let payee_before = h.balance(recipient).await?;
    let mut every_settled = true;
    for byte in 128..=255 {
        let q = quote(h, core, &buyer, merchant, key, byte, 1).await?;
        let raw = pay(h, core, &buyer, &q, "retained-capacity-payment").await?;
        let record = payment(h, core, &buyer, byte).await?;
        every_settled &= success(&raw)
            && failures(&raw).is_empty()
            && record["state"] == "settled"
            && record["invoice"] == q["invoice"];
    }
    let after = ledger(h, core, &buyer).await?;
    let payee_after = h.balance(recipient).await?;
    let overflow = quote(h, core, &buyer, merchant, key, 0, 1).await?;
    let denied = denied_without_record(h, core, &buyer, &overflow, Value::Null, "CAPACITY").await?;
    // The one case combines this production boundary with real fault-generated
    // pending records below; omitting the fault artifact leaves it not_run.
    Ok((
        start,
        vec![
            ("128 real production payments settle", every_settled),
            (
                "128 retained records with no outstanding transfer",
                after["usage"]["retained_payments"] == 128
                    && after["usage"]["outstanding_transfers"] == 0
                    && after["pending_payment_yocto"] == "0",
            ),
            (
                "128 settlements debit and pay exactly 128 yocto",
                decimal(&before["available_yocto"])?
                    .checked_sub(decimal(&after["available_yocto"])?)
                    == Some(128)
                    && decimal(&payee_after["amount"])?
                        .checked_sub(decimal(&payee_before["amount"])?)
                        == Some(128),
            ),
            (
                "129th retained payment rejects without allocating or charging",
                denied,
            ),
        ],
    ))
}

pub(super) async fn pending_capacity(
    h: &mut Harness,
    core_account: &Account,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
    production_wasm: &[u8],
    retained: (usize, Vec<(&'static str, bool)>),
) -> Result<()> {
    let core = core_account.id();
    let (start, mut checks) = retained;
    // The caller has deployed and code-hash checked the distinct default-off
    // callback-failure build. Each native transfer really succeeds; its actual
    // callback receipt fails, leaving an ordinary persisted Pending liability.
    let buyer = owner(h, "pendinglimit", core, merchant, 121, NEAR).await?;
    let mut args = policy_args(h, core, &buyer).await?;
    args["max_dispatches_per_minute"] = json!(32);
    h.manage(&buyer.owner, core, "set_policy", args).await?;
    let before = ledger(h, core, &buyer).await?;
    let payee_before = h.balance(recipient).await?;
    let mut every_fault_pending = true;
    for byte in 1..=8 {
        let q = quote(h, core, &buyer, merchant, key, byte, 1).await?;
        let raw = pay(h, core, &buyer, &q, "real-pending-capacity-payment").await?;
        let record = payment(h, core, &buyer, byte).await?;
        let callback_failed = failures(&raw).iter().any(|receipt| {
            receipt["outcome"]["executor_id"] == core.as_str()
                && receipt["outcome"]["status"]["Failure"]["ActionError"]["kind"]["FunctionCallError"]["ExecutionError"]
                    == "Smart contract panicked: RUNTIME_TEST_CALLBACK_FAILURE"
        });
        every_fault_pending &= success(&raw)
            && callback_failed
            && failures(&raw).len() == 1
            && record["state"] == "pending"
            && record["invoice"] == q["invoice"];
    }
    let pending = ledger(h, core, &buyer).await?;
    let payee_after = h.balance(recipient).await?;
    let deploy = core_account
        .batch(core)
        .deploy(production_wasm)
        .transact_async()
        .await?;
    let restored = h
        .final_tx("restore-production-after-pending-setup", deploy)
        .await?;
    let code = h.balance(core).await?;
    ensure!(
        success(&restored)
            && failures(&restored).is_empty()
            && code["code_hash"] == bs58::encode(Sha256::digest(production_wasm)).into_string(),
        "production artifact restoration failed"
    );
    let production_pending = ledger(h, core, &buyer).await?;
    let q = quote(h, core, &buyer, merchant, key, 9, 1).await?;
    let ninth_denied = denied_without_record(h, core, &buyer, &q, Value::Null, "CAPACITY").await?;
    let withdrawal = h
        .call(
            "withdrawal-shares-outstanding-capacity",
            buyer
                .owner
                .call(core, "withdraw_available")
                .args_json(json!({"withdrawal_id":id(9),"amount_yocto":"1"}))
                .deposit(NearToken::from_yoctonear(1)),
        )
        .await?;
    let absent = h
        .view(
            core,
            "get_withdrawal",
            json!({"owner_id":buyer.owner.id(),"withdrawal_id":id(9)}),
        )
        .await?;
    let after = ledger(h, core, &buyer).await?;
    checks.extend([
        (
            "eight actual payouts have failed callback receipts and stay pending",
            every_fault_pending,
        ),
        (
            "eight pending reservations are paid and debited exactly once",
            decimal(&before["available_yocto"])?.checked_sub(decimal(&pending["available_yocto"])?)
                == Some(8)
                && decimal(&payee_after["amount"])?.checked_sub(decimal(&payee_before["amount"])?)
                    == Some(8),
        ),
        (
            "owner has exactly eight outstanding pending liabilities",
            pending["usage"]["outstanding_transfers"] == 8
                && pending["usage"]["retained_payments"] == 8
                && pending["pending_payment_yocto"] == "8",
        ),
        (
            "restored production code retains all pending reservations",
            actor_state(&pending) == actor_state(&production_pending),
        ),
        (
            "production rejects ninth payment without new reservation",
            ninth_denied,
        ),
        (
            "production withdrawal shares the same eight-transfer cap",
            panic_code(&withdrawal, "CAPACITY")
                && absent.is_null()
                && actor_state(&production_pending) == actor_state(&after),
        ),
    ]);
    h.case("transfer_capacity", start, checks, &[
        "128 retained-payment boundary uses production settlements. Eight outstanding records are created by real transfers under the separately hashed callback-failure build, then production WASM is restored before both capacity refusals. No callback, payment record or balance is patched.",
        "This establishes behavior under retained pending liabilities if the capture passes, not naturally occurring production callback-failure frequency.",
    ]);
    Ok(())
}
