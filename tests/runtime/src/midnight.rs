//! USER-RUN ONLY: separate bounded timing experiment. Never part of default tests.
mod midnight_assertions;
mod midnight_rpc;
use agenttrust_domain::{codec, owner::ActorState, types::InvoiceV1};
use anyhow::{Context, Result, bail, ensure};
use base64::{Engine, engine::general_purpose::STANDARD};
use midnight_assertions::{DAY_NS, Observed, PAYMENT_GAS_TGAS, WORKER_ALLOWANCE_YOCTO};
use near_workspaces::{
    Account, AccountId, Worker,
    network::{Sandbox, ValidatorKey},
    operations::{Function, TransactionStatus},
    types::{AccessKey, Gas as NearGas, KeyType, NearToken, SecretKey},
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const AMOUNT: u128 = 3 * NEAR / 100;
const SECOND: u64 = 1_000_000_000;
const BLOCK_SECONDS: u64 = 2;
const BUDGET_SECONDS: u64 = 900;
const PAYMENT_ID: u8 = 201;
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn id(byte: u8) -> String {
    STANDARD.encode([byte; 32])
}
fn decimal(v: &Value) -> Result<u128> {
    Ok(v.as_str().context("decimal string")?.parse()?)
}
fn returned(status: &Value) -> Result<Value> {
    let bytes = STANDARD.decode(
        status["SuccessValue"]
            .as_str()
            .context("successful return required")?,
    )?;
    Ok(if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes)?
    })
}
fn function(name: &str, args: Value, deposit: u128) -> Function {
    Function::new(name)
        .args_json(args)
        .gas(NearGas::from_tgas(50))
        .deposit(NearToken::from_yoctonear(deposit))
}
fn persisted_ledger(value: &Value) -> Value {
    let mut value = value.clone();
    // Contract gas rewards change runtime cash, not persisted owner accounting.
    value["vault"]
        .as_object_mut()
        .unwrap()
        .remove("runtime_account_balance_yocto");
    value
}
struct Capture {
    out: PathBuf,
    manifest: Value,
    rpc: reqwest::Client,
    url: String,
    sequence: usize,
}
impl Capture {
    fn save(&self) -> Result<()> {
        fs::write(
            self.out.join("manifest.json"),
            serde_json::to_vec_pretty(&self.manifest)?,
        )?;
        Ok(())
    }
    fn put(&mut self, label: &str, value: &Value) -> Result<()> {
        self.sequence += 1;
        let name = format!("raw/{:03}-{label}.json", self.sequence);
        let bytes = serde_json::to_vec_pretty(value)?;
        fs::write(self.out.join(&name), &bytes)?;
        self.manifest["artifacts"]
            .as_array_mut()
            .unwrap()
            .push(json!({"path":name,"sha256":hash(&bytes)}));
        self.save()
    }
    async fn rpc(&mut self, method: &str, params: Value) -> Result<Value> {
        let request = json!({"jsonrpc":"2.0","id":"midnight","method":method,"params":params});
        let response = match self.rpc.post(&self.url).json(&request).send().await {
            Ok(response) => response,
            Err(error) => {
                self.put(
                    "rpc-transport-error",
                    &json!({"request":request,"error":error.to_string()}),
                )?;
                return Err(error).context(format!("RPC {method} transport failed"));
            }
        };
        let status = response.status().as_u16();
        let body = match response.bytes().await {
            Ok(body) => body,
            Err(error) => {
                self.put(
                    "rpc-body-error",
                    &json!({"request":request,"http_status":status,"error":error.to_string()}),
                )?;
                return Err(error).context(format!("RPC {method} body failed"));
            }
        };
        match midnight_rpc::decode_response(status, &body) {
            Ok(raw) => Ok(raw),
            Err(error) => {
                self.put("rpc-response-error", &json!({"request":request,"http_status":status,
                    "body_base64":STANDARD.encode(&body),"response":serde_json::from_slice::<Value>(&body).ok()}))?;
                Err(error).context(format!("RPC {method} response failed"))
            }
        }
    }
    async fn query(&mut self, label: &str, params: Value) -> Result<Value> {
        let raw = self.rpc("query", params.clone()).await?;
        self.put(label, &json!({"request":params,"response":raw}))?;
        ensure!(raw.get("error").is_none(), "query failed: {label}");
        Ok(raw["result"].clone())
    }
    async fn view(
        &mut self,
        label: &str,
        core: &AccountId,
        method: &str,
        args: Value,
    ) -> Result<Value> {
        let result = self.query(label, json!({"request_type":"call_function","account_id":core,
            "method_name":method,"args_base64":STANDARD.encode(serde_json::to_vec(&args)?),"finality":"final"})).await?;
        decode_view(&result)
    }
    async fn block(&mut self, label: &str, params: Value) -> Result<Value> {
        let raw = self.rpc("block", params.clone()).await?;
        self.put(label, &json!({"request":params,"response":raw}))?;
        ensure!(raw.get("error").is_none(), "block unavailable");
        Ok(raw["result"].clone())
    }
    async fn head(&mut self) -> Result<Value> {
        let raw = self.rpc("block", json!({"finality":"optimistic"})).await?;
        ensure!(raw.get("error").is_none(), "optimistic block unavailable");
        Ok(raw["result"].clone())
    }
    async fn final_tx(&mut self, label: &str, tx: &TransactionStatus) -> Result<Value> {
        // Persist even setup locators before the first status request. A failed
        // observation never authorizes another transaction or a new nonce.
        self.submitted(&format!("{label}-awaiting-final"), tx)?;
        let hash = tx.hash().to_string();
        let params = midnight_rpc::status_request(&hash, tx.sender_id().as_str());
        let start = Instant::now();
        let mut previous = Value::Null;
        loop {
            let remaining = Duration::from_secs(90).saturating_sub(start.elapsed());
            if remaining.is_zero() {
                self.put(
                    "final-timeout",
                    &json!({"request":params,"last_response":previous}),
                )?;
                bail!("FINAL timeout: {label}");
            }
            let raw = match tokio::time::timeout(remaining, self.rpc("tx_status", params.clone()))
                .await
            {
                Ok(raw) => raw?,
                Err(_) => {
                    self.put(
                        "final-timeout",
                        &json!({"request":params,"last_response":previous}),
                    )?;
                    bail!("FINAL timeout: {label}");
                }
            };
            // Preserve the first response and every status/body change, including
            // UNKNOWN_TRANSACTION and terminal errors, before interpretation.
            if raw != previous {
                self.put(
                    &format!("{label}-status"),
                    &json!({"request":params,"response":raw}),
                )?;
                previous = raw.clone();
            }
            if midnight_rpc::is_final(&raw, &hash, tx.sender_id().as_str())? {
                self.put(label, &json!({"request":params,"response":raw}))?;
                let result = &raw["result"];
                ensure!(
                    result["transaction"]["hash"] == tx.hash().to_string()
                        && result["transaction"]["signer_id"] == tx.sender_id().as_str(),
                    "transaction binding"
                );
                ensure!(
                    result["status"].get("SuccessValue").is_some()
                        && result["receipts_outcome"]
                            .as_array()
                            .context("receipt outcomes")?
                            .iter()
                            .all(|r| r["outcome"]["status"].get("Failure").is_none()),
                    "native transaction or receipt failed: {label}"
                );
                return Ok(result.clone());
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }
    fn submitted(&mut self, label: &str, tx: &TransactionStatus) -> Result<()> {
        self.put(
            label,
            &json!({"tx_hash":tx.hash().to_string(),"sender_account_id":tx.sender_id()}),
        )
    }
}
fn decode_view(result: &Value) -> Result<Value> {
    let bytes: Vec<u8> = serde_json::from_value(result["result"].clone())?;
    Ok(serde_json::from_slice(&bytes)?)
}
fn timestamp(block: &Value) -> Result<u64> {
    Ok(decimal(&block["header"]["timestamp_nanosec"])?.try_into()?)
}
async fn call(
    c: &mut Capture,
    who: &Account,
    core: &AccountId,
    name: &str,
    args: Value,
    deposit: u128,
) -> Result<Value> {
    let tx = who
        .call(core, name)
        .args_json(args)
        .gas(NearGas::from_tgas(150))
        .deposit(NearToken::from_yoctonear(deposit))
        .transact_async()
        .await?;
    c.submitted(&format!("{name}-submitted"), &tx)?;
    c.final_tx(name, &tx).await
}
async fn account(
    c: &mut Capture,
    worker: &Worker<Sandbox>,
    root: &Account,
    label: &str,
) -> Result<Account> {
    let account_id: AccountId = format!("{label}.{}", root.id()).parse()?;
    let key = SecretKey::from_random(KeyType::ED25519);
    let tx = root
        .batch(&account_id)
        .create_account()
        .transfer(NearToken::from_near(20))
        .add_key(key.public_key(), AccessKey::full_access())
        .transact_async()
        .await?;
    c.final_tx(&format!("create-{label}"), &tx).await?;
    c.manifest["actors"]
        .as_array_mut()
        .unwrap()
        .push(json!({"role":label,"account_id":account_id,
        "public_key_sha256":hash(key.public_key().to_string().as_bytes())}));
    Ok(Account::from_secret_key(account_id, key, worker))
}
fn event_receipt<'a>(
    raw: &'a Value,
    core: &AccountId,
    event_name: &str,
) -> Result<(&'a Value, Value)> {
    let mut matches = vec![];
    for r in raw["receipts_outcome"]
        .as_array()
        .context("receipt outcomes")?
    {
        if r["outcome"]["executor_id"] != core.as_str()
            || r["outcome"]["status"].get("SuccessValue").is_none()
        {
            continue;
        }
        for log in r["outcome"]["logs"].as_array().context("logs")? {
            if let Some(text) = log.as_str().and_then(|s| s.strip_prefix("EVENT_JSON:")) {
                let event: Value = serde_json::from_str(text)?;
                if event["standard"] == "agenttrust"
                    && event["version"] == "1.0.0"
                    && event["event"] == event_name
                    && event["data"][0]["payment_id"] == id(PAYMENT_ID)
                {
                    matches.push((r, event["data"][0].clone()));
                }
            }
        }
    }
    ensure!(
        matches.len() == 1,
        "exactly one committed {event_name} event required"
    );
    Ok(matches.remove(0))
}
async fn receipt(c: &mut Capture, label: &str, outcome: &Value) -> Result<Value> {
    let params = json!({"receipt_id":outcome["id"]});
    let raw = c.rpc("EXPERIMENTAL_receipt", params.clone()).await?;
    c.put(label, &json!({"request":params,"response":raw}))?;
    ensure!(
        raw["result"]["receipt_id"] == outcome["id"]
            && raw["result"]["receiver_id"] == outcome["outcome"]["executor_id"],
        "receipt binding"
    );
    Ok(raw["result"].clone())
}
async fn receipt_block(c: &mut Capture, label: &str, outcome: &Value) -> Result<Value> {
    let block = c
        .block(label, json!({"block_id":outcome["block_hash"]}))
        .await?;
    ensure!(
        block["header"]["hash"] == outcome["block_hash"],
        "receipt block binding"
    );
    Ok(block)
}
async fn run(c: &mut Capture, wasm: &[u8]) -> Result<()> {
    let config = json!({"consensus":{"min_block_production_delay":{"secs":BLOCK_SECONDS,"nanos":0},
        "max_block_production_delay":{"secs":BLOCK_SECONDS,"nanos":0},
        "max_block_wait_delay":{"secs":12,"nanos":0}}});
    let genesis = json!({"epoch_length":1_000_000});
    c.put(
        "sandbox-controls",
        &json!({"additional_config":config,"additional_genesis":genesis,
        "no_state_patch":true,"no_receipt_control":true,"fast_forward_only_before_payment":true}),
    )?;
    // The only node start. Executing this binary requires separate runtime authorization.
    let sandbox = near_sandbox::Sandbox::start_sandbox_with_config_and_version(
        near_sandbox::SandboxConfig {
            additional_config: Some(config),
            additional_genesis: Some(genesis),
            ..Default::default()
        },
        "2.14.0",
    )
    .await?;
    c.url = sandbox.rpc_addr.clone();
    c.manifest["rpc_url"] = json!(c.url);
    let generated_config: Value =
        serde_json::from_slice(&fs::read(sandbox.home_dir.path().join("config.json"))?)?;
    let generated_genesis: Value =
        serde_json::from_slice(&fs::read(sandbox.home_dir.path().join("genesis.json"))?)?;
    ensure!(
        generated_config["consensus"]["min_block_production_delay"]
            == json!({"secs":BLOCK_SECONDS,"nanos":0})
            && generated_config["consensus"]["max_block_production_delay"]
                == json!({"secs":BLOCK_SECONDS,"nanos":0})
            && generated_genesis["epoch_length"] == 1_000_000,
        "requested timing controls were not installed"
    );
    c.put(
        "installed-sandbox-controls",
        &json!({
            "consensus":generated_config["consensus"],
            "genesis_time":generated_genesis["genesis_time"],
            "epoch_length":generated_genesis["epoch_length"],
            "protocol_version":generated_genesis["protocol_version"],
            "shard_layout":generated_genesis["shard_layout"]
        }),
    )?;
    let worker = near_workspaces::sandbox()
        .rpc_addr(&sandbox.rpc_addr)
        .validator_key(ValidatorKey::HomeDir(sandbox.home_dir.path().to_owned()))
        .await?;
    let status = c.rpc("status", json!([])).await?;
    c.put("status", &status)?;
    let protocol = c
        .rpc("EXPERIMENTAL_protocol_config", json!({"finality":"final"}))
        .await?;
    c.put("protocol", &protocol)?;
    let root = worker.root_account()?;
    let core = account(c, &worker, &root, "core").await?;
    let owner = account(c, &worker, &root, "owner").await?;
    let merchant = account(c, &worker, &root, "merchant").await?;
    let deployment = core
        .batch(core.id())
        .deploy(wasm)
        .call(function(
            "new",
            json!({"network":"near:testnet","operating_reserve_yocto":(NEAR/20).to_string()}),
            0,
        ))
        .transact_async()
        .await?;
    c.final_tx("deploy-production", &deployment).await?;
    let core_account = c
        .query(
            "core-code",
            json!({"request_type":"view_account","account_id":core.id(),"finality":"final"}),
        )
        .await?;
    ensure!(
        bs58::decode(core_account["code_hash"].as_str().context("code hash")?).into_vec()?
            == Sha256::digest(wasm).as_slice(),
        "production code hash"
    );
    call(
        c,
        &owner,
        core.id(),
        "deposit",
        json!({"storage_credit_yocto":(NEAR/4).to_string()}),
        2 * NEAR,
    )
    .await?;
    call(
        c,
        &merchant,
        core.id(),
        "deposit",
        json!({"storage_credit_yocto":(NEAR/4).to_string()}),
        NEAR / 4,
    )
    .await?;
    let invoice_key = near_crypto::SecretKey::from_random(near_crypto::KeyType::ED25519);
    let public = bs58::decode(
        invoice_key
            .public_key()
            .to_string()
            .split_once(':')
            .context("invoice key encoding")?
            .1,
    )
    .into_vec()?;
    call(
        c,
        &merchant,
        core.id(),
        "set_service",
        json!({"expected_version":null,"payout_account":merchant.id(),
        "invoice_key":STANDARD.encode(public),"endpoint_hash":id(44),"active":true}),
        1,
    )
    .await?;
    call(
        c,
        &owner,
        core.id(),
        "set_policy",
        json!({"expected_revision":0,"daily_cap_yocto":(NEAR/20).to_string(),
        "max_dispatches_per_minute":5,"paused":false}),
        1,
    )
    .await?;
    call(
        c,
        &owner,
        core.id(),
        "set_profile",
        json!({"profile_id":"audit","expected_revision":null,"requirement":null}),
        1,
    )
    .await?;
    let worker_key = SecretKey::from_random(KeyType::ED25519);
    let now = timestamp(&c.head().await?)?;
    call(
        c,
        &owner,
        core.id(),
        "register_session",
        json!({"session_id":id(202),"public_key":worker_key.public_key().to_string(),
        "profile_id":"audit","profile_revision":1,"purchase_cap_yocto":(NEAR/25).to_string(),
        "expires_at_ns":(now+2*DAY_NS).to_string()}),
        1,
    )
    .await?;
    call(
        c,
        &owner,
        core.id(),
        "set_service_trust",
        json!({"service_id":merchant.id(),"service_version":1,
        "allowed_profile_ids":["audit"],"expires_at_ns":null,"active":true}),
        1,
    )
    .await?;
    let key_tx = owner
        .batch(owner.id())
        .add_key(
            worker_key.public_key(),
            AccessKey::function_call_access(
                core.id(),
                &["execute_payment"],
                Some(NearToken::from_yoctonear(WORKER_ALLOWANCE_YOCTO)),
            ),
        )
        .transact_async()
        .await?;
    c.final_tx("install-worker", &key_tx).await?;
    let worker_actor = Account::from_secret_key(owner.id().clone(), worker_key, &worker);
    let policy = c
        .view(
            "policy-before",
            core.id(),
            "get_policy",
            json!({"owner_id":owner.id()}),
        )
        .await?;
    let before = c
        .view(
            "ledger-before",
            core.id(),
            "get_account",
            json!({"account_id":owner.id()}),
        )
        .await?;
    let recipient_before = c
        .query(
            "recipient-before",
            json!({"request_type":"view_account","account_id":merchant.id(),"finality":"final"}),
        )
        .await?;
    let key_view = c
        .query(
            "restricted-worker",
            json!({"request_type":"view_access_key","account_id":owner.id(),
        "public_key":worker_actor.secret_key().public_key().to_string(),"finality":"final"}),
        )
        .await?;
    ensure!(
        key_view["permission"]["FunctionCall"]["receiver_id"] == core.id().as_str()
            && key_view["permission"]["FunctionCall"]["method_names"] == json!(["execute_payment"]),
        "restricted worker required"
    );
    // Jump only with all setup transactions FINAL. Offset semantics come from
    // nearcore sandbox_delta_time; the observed head, not the delta, is authoritative.
    let head = c.head().await?;
    let now = timestamp(&head)?;
    let midnight = (now / DAY_NS + 1) * DAY_NS;
    let target = midnight.saturating_sub(30 * SECOND);
    let delta = target.saturating_sub(now) / (BLOCK_SECONDS * SECOND);
    c.put(
        "before-fast-forward",
        &json!({"block":head,"delta_height":delta,"target_midnight_ns":midnight.to_string()}),
    )?;
    if delta > 0 {
        worker.fast_forward(delta).await?;
    }
    let head = c.head().await?;
    c.put("after-fast-forward", &head)?;
    let clock_start = Instant::now();
    let launch_block = loop {
        let head = c.head().await?;
        let now = timestamp(&head)?;
        ensure!(
            now < midnight,
            "TIMING_MISS: crossed midnight before payment"
        );
        let remaining = midnight - now;
        if remaining <= 8 * SECOND {
            ensure!(
                remaining >= 5 * SECOND,
                "TIMING_MISS: launch window skipped"
            );
            break head;
        }
        ensure!(
            clock_start.elapsed() < Duration::from_secs(60),
            "TIMING_MISS: boundary not reached"
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    };
    c.put("launch-block", &launch_block)?;
    let issued = timestamp(&launch_block)?;
    let invoice: InvoiceV1 = serde_json::from_value(
        json!({"schema_version":1,"network":"near:testnet",
        "core_account":core.id(),"owner_id":owner.id(),"session_id":id(202),"payment_id":id(PAYMENT_ID),
        "policy_revision":policy["revision"],"profile_id":"audit","profile_revision":1,"service_id":merchant.id(),
        "service_version":1,"payout_account":merchant.id(),"endpoint_hash":id(44),"request_hash":id(45),
        "asset":"NEAR","amount_yocto":AMOUNT.to_string(),"issued_at_ns":issued.to_string(),"expires_at_ns":(issued+120*SECOND).to_string()}),
    )?;
    let signature = invoice_key.sign(&codec::encode_invoice(&invoice));
    let signature = bs58::decode(
        signature
            .to_string()
            .split_once(':')
            .context("signature encoding")?
            .1,
    )
    .into_vec()?;
    let args = json!({"quote":{"invoice":invoice,"signature":STANDARD.encode(signature)},"credential":null});
    c.put("signed-invoice", &args)?;
    let payment_tx = worker_actor
        .call(core.id(), "execute_payment")
        .args_json(args.clone())
        .gas(NearGas::from_tgas(PAYMENT_GAS_TGAS))
        .transact_async()
        .await?;
    c.submitted("payment-submitted", &payment_tx)?;
    // Poll optimistic state only to schedule the owner transaction. Its block is
    // subsequently required to be canonical and finalized; this is not settlement.
    let pending_start = Instant::now();
    let pending_query = json!({"request_type":"call_function","account_id":core.id(),"method_name":"get_payment",
        "args_base64":STANDARD.encode(serde_json::to_vec(&json!({"owner_id":owner.id(),"payment_id":id(PAYMENT_ID)}))?),"finality":"optimistic"});
    let pending_raw = loop {
        let raw = c.rpc("query", pending_query.clone()).await?;
        ensure!(raw.get("error").is_none(), "pending query failed");
        let value = decode_view(&raw["result"])?;
        if value["state"] == "pending" {
            break raw;
        }
        ensure!(
            value.is_null(),
            "TIMING_MISS: payment already finalized before edits"
        );
        ensure!(
            pending_start.elapsed() < Duration::from_secs(20),
            "TIMING_MISS: no pending observation"
        );
        tokio::time::sleep(Duration::from_millis(25)).await;
    };
    c.put(
        "optimistic-pending",
        &json!({"request":pending_query,"response":pending_raw}),
    )?;
    let edit_tx = owner
        .batch(core.id())
        .call(function(
            "set_policy",
            json!({"expected_revision":policy["revision"],"daily_cap_yocto":(NEAR/50).to_string(),
            "max_dispatches_per_minute":3,"paused":false}),
            1,
        ))
        .call(function(
            "set_profile",
            json!({"profile_id":"audit","expected_revision":1,"requirement":null}),
            1,
        ))
        .call(function("get_account", json!({"account_id":owner.id()}), 0))
        .transact_async()
        .await?;
    c.submitted("edits-submitted", &edit_tx)?;
    let edit_raw = c.final_tx("owner-edit-and-ledger-return", &edit_tx).await?;
    let payment_raw = c.final_tx("payment-final", &payment_tx).await?;
    ensure!(
        payment_raw["transaction"]["actions"][0]["FunctionCall"]["gas"].as_u64()
            == Some(PAYMENT_GAS_TGAS * 1_000_000_000_000),
        "explicit worker gas binding"
    );
    let edit_return = returned(&edit_raw["status"])?;
    let edit_outcomes: Vec<_> = edit_raw["receipts_outcome"]
        .as_array()
        .context("edit receipts")?
        .iter()
        .filter(|r| {
            r["outcome"]["executor_id"] == core.id().as_str()
                && r["outcome"]["status"] == edit_raw["status"]
        })
        .collect();
    ensure!(edit_outcomes.len() == 1, "unique committed edit return");
    let edit_body = receipt(c, "edit-receipt", edit_outcomes[0]).await?;
    let edit_actions = edit_body["receipt"]["Action"]["actions"]
        .as_array()
        .context("edit actions")?;
    ensure!(
        edit_body["predecessor_id"] == owner.id().as_str()
            && edit_actions.len() == 3
            && edit_actions
                .iter()
                .map(|a| a["FunctionCall"]["method_name"].as_str().unwrap_or(""))
                .collect::<Vec<_>>()
                == ["set_policy", "set_profile", "get_account"],
        "exact owner edit receipt"
    );
    let (dispatch_outcome, _) = event_receipt(&payment_raw, core.id(), "payment_dispatched")?;
    let (callback_outcome, final_event) =
        event_receipt(&payment_raw, core.id(), "payment_finalized")?;
    let dispatch_body = receipt(c, "dispatch-receipt", dispatch_outcome).await?;
    let callback_body = receipt(c, "callback-receipt", callback_outcome).await?;
    ensure!(
        dispatch_body["receipt"]["Action"]["actions"][0]["FunctionCall"]["method_name"]
            == "execute_payment"
            && callback_body["predecessor_id"] == core.id().as_str()
            && callback_body["receipt"]["Action"]["actions"][0]["FunctionCall"]["method_name"]
                == "on_payment_result",
        "real native dispatch and private callback required"
    );
    let mut transfers = vec![];
    for outcome in payment_raw["receipts_outcome"]
        .as_array()
        .context("payment receipts")?
    {
        if outcome["outcome"]["executor_id"] != merchant.id().as_str() {
            continue;
        }
        let body = receipt(c, "payout-receipt", outcome).await?;
        let actions = body["receipt"]["Action"]["actions"]
            .as_array()
            .context("payout actions")?;
        if body["predecessor_id"] == core.id().as_str()
            && actions.len() == 1
            && actions[0]["Transfer"]["deposit"] == AMOUNT.to_string()
        {
            transfers.push((body, outcome));
        }
    }
    ensure!(
        transfers.len() == 1,
        "one original native transfer required"
    );
    let (transfer_body, transfer_outcome) = &transfers[0];
    let inputs = callback_body["receipt"]["Action"]["input_data_ids"]
        .as_array()
        .context("callback input")?;
    let outputs = transfer_body["receipt"]["Action"]["output_data_receivers"]
        .as_array()
        .context("transfer outputs")?;
    ensure!(
        inputs.len() == 1
            && outputs
                .iter()
                .any(|out| out["data_id"] == inputs[0] && out["receiver_id"] == core.id().as_str()),
        "callback must depend on this native transfer"
    );
    receipt_block(c, "payout-block", transfer_outcome).await?;
    let dispatch_block = receipt_block(c, "dispatch-block", dispatch_outcome).await?;
    let edit_block = receipt_block(c, "edit-block", edit_outcomes[0]).await?;
    let callback_block = receipt_block(c, "callback-block", callback_outcome).await?;
    let canonical_pending = c
        .block(
            "pending-block-canonical",
            json!({"block_id":pending_raw["result"]["block_height"]}),
        )
        .await?;
    let final_head = c.block("final-head", json!({"finality":"final"})).await?;
    ensure!(
        canonical_pending["header"]["hash"] == pending_raw["result"]["block_hash"]
            && final_head["header"]["height"].as_u64()
                >= canonical_pending["header"]["height"].as_u64(),
        "optimistic observation must finalize canonically"
    );
    let after = c
        .view(
            "ledger-after",
            core.id(),
            "get_account",
            json!({"account_id":owner.id()}),
        )
        .await?;
    let payment = c
        .view(
            "payment-after",
            core.id(),
            "get_payment",
            json!({"owner_id":owner.id(),"payment_id":id(PAYMENT_ID)}),
        )
        .await?;
    let new_policy = c
        .view(
            "policy-after",
            core.id(),
            "get_policy",
            json!({"owner_id":owner.id()}),
        )
        .await?;
    let new_profile = c
        .view(
            "profile-after",
            core.id(),
            "get_profile",
            json!({"owner_id":owner.id(),"profile_id":"audit"}),
        )
        .await?;
    let recipient_after = c
        .query(
            "recipient-after",
            json!({"request_type":"view_account","account_id":merchant.id(),"finality":"final"}),
        )
        .await?;
    // Read-only raw state proves the historical bucket as well as today's view.
    // LookupMap uses its default Identity hasher: prefix + Borsh(account ID).
    let mut actor_key = b"actors:v1".to_vec();
    actor_key.extend(borsh::to_vec(owner.id())?);
    let encoded_actor_key = STANDARD.encode(&actor_key);
    let state = c
        .query(
            "raw-state-after",
            json!({"request_type":"view_state","account_id":core.id(),
        "prefix_base64":encoded_actor_key,"finality":"final"}),
        )
        .await?;
    let matches: Vec<_> = state["values"]
        .as_array()
        .context("state values")?
        .iter()
        .filter(|item| item["key"] == encoded_actor_key)
        .collect();
    ensure!(matches.len() == 1, "exact stored actor key required");
    let actor: ActorState =
        borsh::from_slice(&STANDARD.decode(matches[0]["value"].as_str().context("actor state")?)?)?;
    ensure!(actor.owner_id == *owner.id(), "stored actor owner binding");
    let dispatch_ns = timestamp(&dispatch_block)?;
    let callback_ns = timestamp(&callback_block)?;
    let old_day = dispatch_ns / DAY_NS;
    let callback_day = callback_ns / DAY_NS;
    c.put(
        "decoded-original-day",
        &json!({"owner_id":owner.id(),"dispatch_day":old_day,"callback_day":callback_day,
        "settled_by_dispatch_day":actor.usage.settled_by_dispatch_day}),
    )?;
    let observed = Observed {
        dispatch_ns,
        edit_ns: timestamp(&edit_block)?,
        callback_ns,
        amount: AMOUNT,
        available_before: decimal(&before["available_yocto"])?,
        available_in_edit: decimal(&edit_return["available_yocto"])?,
        available_final: decimal(&after["available_yocto"])?,
        pending_in_edit: decimal(&edit_return["pending_payment_yocto"])?,
        pending_final: decimal(&after["pending_payment_yocto"])?,
        old_day_settled: actor
            .usage
            .settled_by_dispatch_day
            .get(&old_day)
            .map_or(0, |v| v.0),
        callback_day_settled: actor
            .usage
            .settled_by_dispatch_day
            .get(&callback_day)
            .map_or(0, |v| v.0),
        recipient_delta: decimal(&recipient_after["amount"])?
            .checked_sub(decimal(&recipient_before["amount"])?)
            .context("recipient balance fell")?,
    };
    let mut checks = midnight_assertions::checks(&observed);
    checks.extend([
        (
            "payment is settled with original invoice",
            payment["state"] == "settled" && payment["invoice"] == args["quote"]["invoice"],
        ),
        (
            "stored payment and committed callback match execution timestamps",
            decimal(&payment["dispatched_at_ns"])? == dispatch_ns as u128
                && decimal(&payment["finalized_at_ns"])? == callback_ns as u128
                && final_event["finalized_at_ns"] == payment["finalized_at_ns"]
                && decimal(&payment["dispatch_day"])? == old_day as u128,
        ),
        (
            "both owner edits committed before ledger return",
            new_policy["daily_cap_yocto"] == (NEAR / 50).to_string()
                && new_policy["revision"].as_u64() == policy["revision"].as_u64().map(|r| r + 2)
                && new_profile["revision"] == 2,
        ),
        (
            "pending reservation survives a daily cap lower than the liability",
            decimal(&edit_return["pending_payment_yocto"])? > NEAR / 50
                && edit_return["usage"]["outstanding_transfers"] == 1
                && edit_return["usage"]["retained_payments"] == 1,
        ),
        (
            "aggregate available claims are unchanged by edits or callback",
            decimal(&before["vault"]["total_available_yocto"])?.checked_sub(AMOUNT)
                == Some(decimal(&edit_return["vault"]["total_available_yocto"])?)
                && edit_return["vault"]["total_available_yocto"]
                    == after["vault"]["total_available_yocto"],
        ),
        (
            "today's final view is uncharged",
            decimal(&after["usage"]["current_day"])? == callback_day as u128
                && after["usage"]["settled_current_day_yocto"] == "0",
        ),
    ]);
    c.manifest["ordering"] = json!({"dispatch_ns":dispatch_ns.to_string(),"edit_ns":observed.edit_ns.to_string(),
        "callback_ns":callback_ns.to_string(),"same_block_edit_callback":edit_outcomes[0]["block_hash"]==callback_outcome["block_hash"],
        "equal_timestamp_order_proof":"committed post-edit account return still contains this sole pending payment"});
    c.manifest["assertions"] = json!(
        checks
            .iter()
            .map(|(name, pass)| json!({"name":name,"passed":pass}))
            .collect::<Vec<_>>()
    );
    c.save()?;
    ensure!(
        checks.iter().all(|(_, pass)| *pass),
        "TIMING_OR_ACCOUNTING_ASSERTION_FAILED; retain this attempt, do not relabel"
    );
    // Exactly one replay with the original quote/key/ID, after changed policy/profile.
    let replay = worker_actor
        .call(core.id(), "execute_payment")
        .args_json(args)
        .gas(NearGas::from_tgas(PAYMENT_GAS_TGAS))
        .transact_async()
        .await?;
    c.submitted("exact-replay-submitted", &replay)?;
    let replay_raw = c.final_tx("exact-replay-final", &replay).await?;
    ensure!(
        replay_raw["transaction"]["actions"][0]["FunctionCall"]["gas"].as_u64()
            == Some(PAYMENT_GAS_TGAS * 1_000_000_000_000),
        "explicit replay gas binding"
    );
    let replay_value = returned(&replay_raw["status"])?;
    let replay_payment = c
        .view(
            "payment-after-replay",
            core.id(),
            "get_payment",
            json!({"owner_id":owner.id(),"payment_id":id(PAYMENT_ID)}),
        )
        .await?;
    let replay_ledger = c
        .view(
            "ledger-after-replay",
            core.id(),
            "get_account",
            json!({"account_id":owner.id()}),
        )
        .await?;
    let replay_recipient = c
        .query(
            "recipient-after-replay",
            json!({"request_type":"view_account","account_id":merchant.id(),"finality":"final"}),
        )
        .await?;
    let replay_ok = replay_value["duplicate"] == true
        && replay_value["payment"] == payment
        && replay_payment == payment
        && persisted_ledger(&replay_ledger) == persisted_ledger(&after)
        && replay_recipient["amount"] == recipient_after["amount"];
    c.manifest["assertions"].as_array_mut().unwrap().push(json!({"name":"exact replay after edits preserves full payment, persisted ledger and payout","passed":replay_ok}));
    c.save()?;
    ensure!(replay_ok, "REPLAY_CHANGED_STATE");
    Ok(())
}
#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args == ["--help"] {
        println!(
            "USER-RUN ONLY: NEAR_SANDBOX_BIN_PATH=/absolute/pinned/near-sandbox agenttrust-midnight --user-run --wasm /absolute/production.wasm --out /absolute/NEW-output"
        );
        return Ok(());
    }
    ensure!(
        args.len() == 5 && args[0] == "--user-run" && args[1] == "--wasm" && args[3] == "--out",
        "EXPLICIT_USER_RUN_ARGUMENTS_REQUIRED"
    );
    let wasm_path = Path::new(&args[2]);
    let out = PathBuf::from(&args[4]);
    let binary = PathBuf::from(
        std::env::var("NEAR_SANDBOX_BIN_PATH")
            .context("pinned binary required; no download fallback")?,
    );
    ensure!(
        wasm_path.is_absolute() && out.is_absolute() && binary.is_absolute() && binary.is_file(),
        "absolute input paths required"
    );
    let wasm = fs::read(wasm_path)?;
    ensure!(
        wasm.starts_with(b"\0asm")
            && !wasm
                .windows(b"RUNTIME_TEST_CALLBACK_FAILURE".len())
                .any(|s| s == b"RUNTIME_TEST_CALLBACK_FAILURE")
            && !wasm
                .windows(b"AGENTTRUST_RUNTIME_HELPER_ONLY".len())
                .any(|s| s == b"AGENTTRUST_RUNTIME_HELPER_ONLY"),
        "production WASM required"
    );
    fs::create_dir(&out).context("output must be new; no overwrite")?;
    fs::create_dir(out.join("raw"))?;
    let commit = std::process::Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()?;
    let dirty = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .output()?;
    let mut c = Capture {
        out,
        url: String::new(),
        sequence: 0,
        rpc: reqwest::Client::builder()
            .timeout(Duration::from_secs(40))
            .redirect(reqwest::redirect::Policy::none())
            .build()?,
        manifest: json!({"schema_version":1,"kind":"agenttrust_midnight_fixture","verification_ids":["V15"],
            "status":"incomplete","exit_status":2,"captured_at":chrono::Utc::now().to_rfc3339(),
            "git_commit":String::from_utf8(commit.stdout)?.trim(),"working_tree_dirty":!dirty.stdout.is_empty(),
            "production_wasm_sha256":hash(&wasm),"sandbox_binary_sha256":hash(&fs::read(binary)?),
            "runtime_lock_sha256":hash(&fs::read("tests/runtime/Cargo.lock")?),
            "command":std::env::var("AGENTTRUST_RUNTIME_COMMAND").unwrap_or_else(|_|"direct fixture invocation".into()),
            "budget":{"wall_seconds":BUDGET_SECONDS,"scenario_attempts":1,"payments":1,"exact_replays":1,
                "payout_yocto":AMOUNT.to_string(),"worker_allowance_near":1,"block_seconds":BLOCK_SECONDS},
            "actors":[],"artifacts":[],"assertions":[],
            "limitations":["Separate timing fixture; does not satisfy refund_gap or the full runtime matrix.",
                "Timing misses are failures; no state patch, injected callback, fault WASM, or inferred RPC array ordering.",
                "RPC data and local file hashes are evidence, not a light-client proof."]}),
    };
    c.save()?;
    let outcome =
        tokio::time::timeout(Duration::from_secs(BUDGET_SECONDS), run(&mut c, &wasm)).await;
    match outcome {
        Ok(Ok(())) => {
            c.manifest["status"] = json!("passed");
            c.manifest["exit_status"] = json!(0);
        }
        Ok(Err(error)) => {
            c.manifest["status"] = json!("failed");
            c.manifest["exit_status"] = json!(1);
            c.manifest["failure"] = json!(format!("{error:#}"));
        }
        Err(_) => {
            c.manifest["status"] = json!("failed");
            c.manifest["exit_status"] = json!(1);
            c.manifest["failure"] = json!("FIXTURE_WALL_BUDGET_EXCEEDED");
        }
    }
    c.manifest["captured_at"] = json!(chrono::Utc::now().to_rfc3339());
    c.save()?;
    println!(
        "{} {}",
        c.manifest["status"],
        c.out.join("manifest.json").display()
    );
    std::process::exit(c.manifest["exit_status"].as_i64().unwrap_or(1) as i32);
}
