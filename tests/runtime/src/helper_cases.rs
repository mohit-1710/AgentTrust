//! USER-RUN ONLY: independently hashed helper contracts create real receipt chains.
use super::matrix::actor_state;
use super::*;

struct CapturedReceipt {
    body: Value,
    outcome: Value,
}
impl CapturedReceipt {
    fn action(&self) -> &Value {
        &self.body["receipt"]["Action"]
    }
    fn has_method(&self, method: &str) -> bool {
        self.action()["actions"].as_array().is_some_and(|actions| {
            actions
                .iter()
                .any(|action| action["FunctionCall"]["method_name"] == method)
        })
    }
    fn only_action(&self) -> Option<&Value> {
        let actions = self.action()["actions"].as_array()?;
        (actions.len() == 1).then(|| &actions[0])
    }
    fn succeeded(&self) -> bool {
        self.outcome["outcome"]["status"]
            .get("SuccessValue")
            .is_some()
    }
    fn result(&self) -> Result<Value> {
        returned(&json!({"result":{"status":self.outcome["outcome"]["status"]}}))
    }
}
fn withdrawal_event(receipt: &CapturedReceipt, name: &str, withdrawal_id: &str) -> Result<Value> {
    ensure!(
        receipt.succeeded(),
        "failed receipt cannot establish committed withdrawal event"
    );
    let mut events = Vec::new();
    for log in receipt.outcome["outcome"]["logs"]
        .as_array()
        .context("receipt logs")?
    {
        if let Some(payload) = log.as_str().and_then(|log| log.strip_prefix("EVENT_JSON:")) {
            let event: Value = serde_json::from_str(payload)?;
            if event["standard"] == "agenttrust"
                && event["version"] == "1.0.0"
                && event["event"] == name
                && event["data"][0]["withdrawal_id"] == withdrawal_id
            {
                events.push(event["data"][0].clone());
            }
        }
    }
    ensure!(events.len() == 1, "expected one committed withdrawal event");
    Ok(events.remove(0))
}
async fn receipts(h: &mut Harness, raw: &Value) -> Result<Vec<CapturedReceipt>> {
    let mut receipts = Vec::new();
    for outcome in raw["result"]["receipts_outcome"]
        .as_array()
        .context("FINAL receipt outcomes")?
    {
        let id = outcome["id"].as_str().context("receipt ID")?;
        let request = json!({"receipt_id":id});
        let response = h.rpc("EXPERIMENTAL_receipt", request.clone()).await?;
        h.artifact("native-receipt-payload", "receipt_payload", &json!({
            "transaction_hash":raw["result"]["transaction"]["hash"],"request":request,"response":response,
        }))?;
        ensure!(
            response.get("error").is_none() && response["result"]["receipt_id"] == id,
            "receipt payload unavailable or misbound"
        );
        ensure!(
            response["result"]["receiver_id"] == outcome["outcome"]["executor_id"],
            "receipt executor mismatch"
        );
        receipts.push(CapturedReceipt {
            body: response["result"].clone(),
            outcome: outcome.clone(),
        });
    }
    Ok(receipts)
}
fn one<'a>(
    receipts: &'a [CapturedReceipt],
    predicate: impl Fn(&CapturedReceipt) -> bool,
) -> Result<&'a CapturedReceipt> {
    let matches: Vec<_> = receipts
        .iter()
        .filter(|receipt| predicate(receipt))
        .collect();
    ensure!(
        matches.len() == 1,
        "expected exactly one matching native receipt"
    );
    Ok(matches[0])
}
fn dependent_on(child: &CapturedReceipt, parent: &CapturedReceipt) -> bool {
    let Some(inputs) = child.action()["input_data_ids"].as_array() else {
        return false;
    };
    let Some(outputs) = parent.action()["output_data_receivers"].as_array() else {
        return false;
    };
    inputs.len() == 1
        && outputs.iter().any(|output| {
            output["data_id"] == inputs[0] && output["receiver_id"] == child.body["receiver_id"]
        })
}
fn exact_call(
    receipt: &CapturedReceipt,
    method: &str,
    args: &Value,
    deposit: &str,
) -> Result<bool> {
    let Some(action) = receipt.only_action() else {
        return Ok(false);
    };
    let call = &action["FunctionCall"];
    if call["method_name"] != method || call["deposit"] != deposit {
        return Ok(false);
    }
    let bytes = STANDARD.decode(call["args"].as_str().context("function args")?)?;
    Ok(serde_json::from_slice::<Value>(&bytes)? == *args)
}
async fn deploy_helper(h: &mut Harness, account: &Account, helper: &[u8]) -> Result<()> {
    let tx = account
        .batch(account.id())
        .deploy(helper)
        .transact_async()
        .await?;
    let deployed = h.final_tx("deploy-runtime-helper", tx).await?;
    let code = h.balance(account.id()).await?;
    ensure!(
        success(&deployed)
            && failures(&deployed).is_empty()
            && code["code_hash"] == bs58::encode(Sha256::digest(helper)).into_string(),
        "runtime helper deploy/hash mismatch"
    );
    Ok(())
}
pub(super) async fn run(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
    helper: &[u8],
) -> Result<()> {
    relay(h, core, merchant, key, recipient, helper).await?;
    withdrawal_failure(h, core, helper).await
}

async fn relay(
    h: &mut Harness,
    core: &AccountId,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    recipient: &AccountId,
    helper: &[u8],
) -> Result<()> {
    let start = h.start();
    let relay = h
        .worker
        .root_account()?
        .create_subaccount("relay")
        .initial_balance(NearToken::from_near(3))
        .transact()
        .await?
        .into_result()?;
    h.actor("runtime-only-relay", &relay);
    deploy_helper(h, &relay, helper).await?;
    let buyer = owner(h, "relaybuyer", core, merchant, 130, NEAR).await?;
    let relay_key = SecretKey::from_random(KeyType::ED25519);
    let now = h.timestamp().await?;
    let session = h.manage(&buyer.owner, core, "register_session", json!({"session_id":id(131),"public_key":relay_key.public_key().to_string(),"profile_id":"audit","profile_revision":1,"purchase_cap_yocto":(NEAR/10).to_string(),"expires_at_ns":(now+86_400_000_000_000u64).to_string()})).await?;
    // This key is intentionally restricted to the test relay, proving the core
    // rejects relaying even when the original signer and registered key match.
    let installed = buyer
        .owner
        .batch(buyer.owner.id())
        .add_key(
            relay_key.public_key(),
            AccessKey::function_call_access(
                relay.id(),
                &["forward_payment"],
                Some(STANDARD_WORKER_ALLOWANCE),
            ),
        )
        .transact_async()
        .await?;
    ensure!(
        success(&h.final_tx("relay-only-test-key", installed).await?),
        "relay test key installation failed"
    );
    let relayed = Fixture {
        owner: buyer.owner.clone(),
        worker: Account::from_secret_key(buyer.owner.id().clone(), relay_key, &h.worker),
        session_id: id(131),
    };
    let q = quote(h, core, &relayed, merchant, key, 131, NEAR / 100).await?;
    let preview = h
        .view(
            core,
            "preview_payment",
            json!({"quote":q,"credential":null}),
        )
        .await?;
    let before = ledger(h, core, &relayed).await?;
    let payee_before = h.balance(recipient).await?;
    let raw = h
        .call(
            "correct-signer-relayed-payment",
            relayed
                .worker
                .call(relay.id(), "forward_payment")
                .args_json(json!({"core_account":core,"quote":q,"credential":null})),
        )
        .await?;
    let captured = receipts(h, &raw).await?;
    let call = one(&captured, |r| {
        r.body["receiver_id"] == core.as_str() && r.has_method("execute_payment")
    })?;
    let record = payment(h, core, &relayed, 131).await?;
    let after = ledger(h, core, &relayed).await?;
    let payee_after = h.balance(recipient).await?;
    h.case("relay_predecessor", start, vec![
        ("invoice and current policy allow before caller authorization", preview["decision"]["kind"] == "allow"),
        ("actual original owner and registered signer key reach core", raw["result"]["transaction"]["signer_id"] == relayed.owner.id().as_str() && call.action()["signer_id"] == relayed.owner.id().as_str() && call.action()["signer_public_key"] == session["public_key"] && call.action()["signer_public_key"] == relayed.worker.secret_key().public_key().to_string()),
        ("core receives unchanged zero-deposit quote from foreign predecessor", call.body["predecessor_id"] == relay.id().as_str() && call.body["predecessor_id"] != call.action()["signer_id"] && exact_call(call, "execute_payment", &json!({"quote":q,"credential":null}), "0")?),
        ("core explicitly rejects relayed predecessor", call.succeeded() && call.result()?["decision"]["code"] == "UNAUTHORIZED" && rejection(&raw, "UNAUTHORIZED")),
        ("relay allocates and charges nothing", record.is_null() && actor_state(&before) == actor_state(&after) && payee_before["amount"] == payee_after["amount"]),
    ], &["The isolated test key permits only the relay method; production worker credentials still permit only the core execute_payment method. Helper code is a separately hashed test fixture."]);
    Ok(())
}

async fn withdrawal_failure(h: &mut Harness, core: &AccountId, helper: &[u8]) -> Result<()> {
    let start = h.start();
    let owner = actor(h, "deletedowner", core, NEAR / 4).await?;
    deploy_helper(h, &owner, helper).await?;
    let root = h.worker.root_account()?;
    let args = json!({"withdrawal_id":id(132),"amount_yocto":(NEAR/100).to_string()});
    let before = h
        .view(core, "get_account", json!({"account_id":owner.id()}))
        .await?;
    let raw = h.call("delete-owner-before-withdrawal", owner.call(owner.id(), "delete_then_withdraw").args_json(json!({"core_account":core,"beneficiary_id":root.id(),"withdrawal_id":args["withdrawal_id"],"amount_yocto":args["amount_yocto"]}))).await?;
    let captured = receipts(h, &raw).await?;
    let deleted = one(&captured, |r| {
        r.body["receiver_id"] == owner.id().as_str()
            && r.only_action()
                .is_some_and(|a| a.get("DeleteAccount").is_some())
    })?;
    let admission = one(&captured, |r| {
        r.body["receiver_id"] == core.as_str() && r.has_method("withdraw_available")
    })?;
    let payout = one(&captured, |r| {
        r.body["predecessor_id"] == core.as_str()
            && r.body["receiver_id"] == owner.id().as_str()
            && r.only_action()
                .is_some_and(|a| a["Transfer"]["deposit"] == args["amount_yocto"])
    })?;
    let callback = one(&captured, |r| {
        r.body["receiver_id"] == core.as_str() && r.has_method("on_withdrawal_result")
    })?;
    let dispatch_event = withdrawal_event(admission, "withdrawal_dispatched", &id(132))?;
    let final_event = withdrawal_event(callback, "withdrawal_finalized", &id(132))?;
    let failed = h
        .view(
            core,
            "get_withdrawal",
            json!({"owner_id":owner.id(),"withdrawal_id":id(132)}),
        )
        .await?;
    let after = h
        .view(core, "get_account", json!({"account_id":owner.id()}))
        .await?;
    // Recreate the same isolated named account with a fresh full-access test
    // key; no stale signer nonce cache is reused. This is not a worker key.
    let recreated_key = SecretKey::from_random(KeyType::ED25519);
    let recreated = root
        .batch(owner.id())
        .create_account()
        .transfer(NearToken::from_near(2))
        .add_key(recreated_key.public_key(), AccessKey::full_access())
        .transact_async()
        .await?;
    let created = h.final_tx("recreate-withdrawal-owner", recreated).await?;
    ensure!(
        success(&created) && failures(&created).is_empty(),
        "owner recreation failed"
    );
    let owner_again = Account::from_secret_key(owner.id().clone(), recreated_key, &h.worker);
    h.actor("recreated-withdrawal-owner", &owner_again);
    let retry = h
        .call(
            "failed-withdrawal-same-id-retry",
            owner_again
                .call(core, "withdraw_available")
                .args_json(args.clone())
                .deposit(NearToken::from_yoctonear(1)),
        )
        .await?;
    let retry_receipts = receipts(h, &retry).await?;
    let final_record = h
        .view(
            core,
            "get_withdrawal",
            json!({"owner_id":owner.id(),"withdrawal_id":id(132)}),
        )
        .await?;
    let final_ledger = h
        .view(core, "get_account", json!({"account_id":owner.id()}))
        .await?;
    h.case("withdrawal_failure", start, vec![
        ("actual owner DeleteAccount succeeds before dependent core admission", deleted.succeeded() && dependent_on(admission, deleted)),
        ("deleted owner retains exact direct signer authority in the created receipt", admission.body["predecessor_id"] == owner.id().as_str() && admission.action()["signer_id"] == owner.id().as_str() && admission.action()["signer_public_key"] == owner.secret_key().public_key().to_string() && exact_call(admission, "withdraw_available", &args, "1")?),
        ("core admits the exact withdrawal as pending", admission.succeeded() && admission.result()?["state"] == "pending" && admission.result()?["payout_account"] == owner.id().as_str()),
        ("native payout fails because named owner account is absent", payout.outcome["outcome"]["status"]["Failure"]["ActionError"]["kind"]["AccountDoesNotExist"]["account_id"] == owner.id().as_str()),
        ("real private callback finalizes its failed transfer", callback.body["predecessor_id"] == core.as_str() && dependent_on(callback, payout) && callback.succeeded() && callback.result()?["state"] == "failed" && failed["state"] == "failed"),
        ("committed dispatch debits and callback restores exact principal", decimal(&before["vault"]["total_available_yocto"])?.checked_sub(decimal(&dispatch_event["backing"]["total_available_after_reservation_yocto"])?) == Some(NEAR/100) && decimal(&final_event["backing"]["total_available_yocto"])?.checked_sub(decimal(&dispatch_event["backing"]["total_available_after_reservation_yocto"])?) == Some(NEAR/100)),
        ("definitive failure restores available once and clears outstanding", before["available_yocto"] == after["available_yocto"] && after["usage"]["outstanding_transfers"] == 0 && after["pending_payment_yocto"] == "0"),
        ("recreated owner same-ID retry preserves failed record and accounting", success(&retry) && failures(&retry).is_empty() && returned(&retry)? == failed && final_record == failed && actor_state(&after) == actor_state(&final_ledger)),
        ("failed withdrawal retry creates no further principal transfer", !retry_receipts.iter().any(|r| r.body["predecessor_id"] == core.as_str() && r.only_action().is_some_and(|a| a.get("Transfer").is_some()))),
    ], &["Only isolated Sandbox fixture accounts are deleted/recreated. The helper schedules real protocol receipts; no callback outcome, owner ledger or native balance is patched."]);
    Ok(())
}
