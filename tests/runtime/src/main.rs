//! USER-RUN ONLY. Starting this binary creates a Sandbox database and local chain.
//! Compile with cargo check; never include it in the default test/build workspace.
mod helper_cases;
mod matrix;
mod rpc_rejections;
use agenttrust_domain::{codec, types::InvoiceV1};
use anyhow::{Context, Result, bail, ensure};
use base64::{Engine, engine::general_purpose::STANDARD};
use near_workspaces::{
    Account, AccountId, Worker,
    network::Sandbox,
    operations::{CallTransaction, TransactionStatus},
    types::{AccessKey, KeyType, NearToken, SecretKey},
};
use rpc_rejections::{KeyRejection, rejection_evidence};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const REQUIRED_CASES: &[(&str, &[&str])] = &[
    ("initialization_authority", &["V01"]),
    ("restricted_key", &["V02"]),
    ("actual_signer", &["V03", "V04"]),
    ("session_and_profile_changes", &["V03", "V04"]),
    ("exact_limits_and_preview", &["V12", "V14"]),
    ("fixed_minute_rate", &["V14"]),
    ("trust_and_identity_changes", &["V08", "V09"]),
    ("credential_changes", &["V10", "V11"]),
    ("actor_capacity_and_storage", &["V22"]),
    ("relay_predecessor", &["V03"]),
    ("transfer_capacity", &["V22"]),
    ("withdrawal_failure", &["V21"]),
    ("signed_dispatch", &["V06", "V16"]),
    ("replay_conflict", &["V20"]),
    ("concurrent_cap", &["V12", "V13"]),
    ("failed_transfer", &["V17"]),
    ("private_callback", &["V19"]),
    ("withdrawal", &["V21"]),
    ("callback_failure", &["V18"]),
    ("refund_gap", &["V17"]),
    ("midnight_and_edits", &["V15"]),
];
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn decimal(value: &Value) -> Result<u128> {
    value
        .as_str()
        .context("expected decimal string")?
        .parse()
        .context("invalid decimal")
}
fn success(raw: &Value) -> bool {
    raw["result"]["status"].get("SuccessValue").is_some()
}
fn failures(raw: &Value) -> Vec<&Value> {
    raw["result"]["receipts_outcome"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|r| r["outcome"]["status"].get("Failure").is_some())
        .collect()
}
// Logs from a failed receipt are observations of rolled-back work, never committed events.
fn committed_event(raw: &Value, core: &AccountId, name: &str, payment_id: &str) -> Result<Value> {
    let mut matches = Vec::new();
    for receipt in raw["result"]["receipts_outcome"]
        .as_array()
        .context("receipt outcomes")?
    {
        let outcome = &receipt["outcome"];
        if outcome["executor_id"] != core.as_str() || outcome["status"].get("Failure").is_some() {
            continue;
        }
        for log in outcome["logs"].as_array().context("receipt logs")? {
            let Some(payload) = log.as_str().and_then(|x| x.strip_prefix("EVENT_JSON:")) else {
                continue;
            };
            let event: Value = serde_json::from_str(payload)?;
            if event["standard"] == "agenttrust"
                && event["version"] == "1.0.0"
                && event["event"] == name
                && event["data"][0]["payment_id"] == payment_id
            {
                matches.push(event["data"][0].clone());
            }
        }
    }
    ensure!(
        matches.len() == 1,
        "expected one committed {name} event for payment"
    );
    Ok(matches.remove(0))
}
fn returned(raw: &Value) -> Result<Value> {
    let bytes = STANDARD.decode(
        raw["result"]["status"]["SuccessValue"]
            .as_str()
            .context("transaction did not return success")?,
    )?;
    if bytes.is_empty() {
        Ok(Value::Null)
    } else {
        Ok(serde_json::from_slice(&bytes)?)
    }
}
fn id(byte: u8) -> String {
    STANDARD.encode([byte; 32])
}

struct Harness {
    worker: Worker<Sandbox>,
    rpc: reqwest::Client,
    out: PathBuf,
    manifest: Value,
    sequence: usize,
}
impl Harness {
    fn actor(&mut self, role: &str, account: &Account) {
        self.manifest["actors"].as_array_mut().unwrap().push(json!({"role":role,"account_id":account.id(),"public_key_sha256":hash(account.secret_key().public_key().to_string().as_bytes())}));
    }
    fn artifact(&mut self, label: &str, kind: &str, value: &Value) -> Result<Value> {
        self.sequence += 1;
        let name = format!("raw/{:03}-{label}.json", self.sequence);
        let bytes = serde_json::to_vec_pretty(value)?;
        fs::write(self.out.join(&name), &bytes)?;
        let reference = json!({"path":name,"sha256":hash(&bytes),"kind":kind});
        self.manifest["artifacts"]
            .as_array_mut()
            .unwrap()
            .push(reference.clone());
        Ok(reference)
    }
    async fn rpc(&self, method: &str, params: Value) -> Result<Value> {
        Ok(self
            .rpc
            .post(self.worker.rpc_addr())
            .json(
                &json!({"jsonrpc":"2.0","id":"agenttrust-runtime","method":method,"params":params}),
            )
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?)
    }
    async fn final_tx(&mut self, label: &str, submitted: TransactionStatus) -> Result<Value> {
        let started = Instant::now();
        let params = json!({"tx_hash":submitted.hash().to_string(),"sender_account_id":submitted.sender_id(),"wait_until":"FINAL"});
        loop {
            let raw = self.rpc("tx_status", params.clone()).await?;
            if raw["result"]["final_execution_status"] == "FINAL" {
                ensure!(
                    raw["result"]["transaction"]["hash"] == submitted.hash().to_string(),
                    "transaction hash mismatch"
                );
                ensure!(
                    raw["result"]["transaction"]["signer_id"] == submitted.sender_id().as_str(),
                    "transaction signer mismatch"
                );
                self.artifact(label, "final_transaction", &raw)?;
                return Ok(raw);
            }
            // Deliberately do not fall back to INCLUDED/EXECUTED or broadcast_tx_commit.
            if started.elapsed() > Duration::from_secs(90) {
                bail!("FINAL timeout for {label}: {}", submitted.hash());
            }
            if raw["error"]["code"] == -32601 {
                bail!("Sandbox must support tx_status wait_until=FINAL (nearcore 2.14 or newer)");
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    }
    async fn call(&mut self, label: &str, call: CallTransaction) -> Result<Value> {
        let pending = call.max_gas().transact_async().await?;
        self.final_tx(label, pending).await
    }
    async fn manage(
        &mut self,
        who: &Account,
        core: &AccountId,
        method: &str,
        args: Value,
    ) -> Result<Value> {
        let raw = self
            .call(
                method,
                who.call(core, method)
                    .args_json(args)
                    .deposit(NearToken::from_yoctonear(1)),
            )
            .await?;
        ensure!(
            success(&raw) && failures(&raw).is_empty(),
            "management {method} failed"
        );
        returned(&raw)
    }
    async fn view(&mut self, core: &AccountId, method: &str, args: Value) -> Result<Value> {
        let request = json!({"request_type":"call_function","account_id":core,"method_name":method,"args_base64":STANDARD.encode(serde_json::to_vec(&args)?),"finality":"final"});
        let raw = self.rpc("query", request.clone()).await?;
        self.artifact(
            method,
            "final_view",
            &json!({"request":request,"response":raw}),
        )?;
        decode_view(&raw)
    }
    async fn balance(&mut self, account: &AccountId) -> Result<Value> {
        let request =
            json!({"request_type":"view_account","account_id":account,"finality":"final"});
        let raw = self.rpc("query", request.clone()).await?;
        self.artifact(
            "account",
            "final_account",
            &json!({"request":request,"response":raw}),
        )?;
        ensure!(raw.get("error").is_none(), "view_account failed");
        Ok(raw["result"].clone())
    }
    async fn timestamp(&self) -> Result<u64> {
        let raw = self.rpc("block", json!({"finality":"final"})).await?;
        raw["result"]["header"]["timestamp_nanosec"]
            .as_str()
            .context("missing block timestamp")?
            .parse()
            .context("timestamp range")
    }
    fn case(&mut self, name: &str, start: usize, checks: Vec<(&str, bool)>, limitations: &[&str]) {
        let assertions: Vec<Value> = checks
            .iter()
            .map(|(name, passed)| json!({"name":name,"passed":passed}))
            .collect();
        let passed = !checks.is_empty() && checks.iter().all(|(_, ok)| *ok);
        let refs = self.manifest["artifacts"].as_array().unwrap()[start..].to_vec();
        self.manifest["cases"][name] = json!({"status":if passed {"passed"} else {"failed"},"verification_ids":REQUIRED_CASES.iter().find(|(n,_)| *n==name).unwrap().1,"assertions":assertions,"artifacts":refs,"limitations":limitations});
    }
    fn start(&self) -> usize {
        self.manifest["artifacts"].as_array().unwrap().len()
    }
    fn save(&mut self) -> Result<()> {
        let cases = self.manifest["cases"].as_object().unwrap();
        let status = if self.manifest.get("fatal_error").is_some()
            || cases.values().any(|x| x["status"] == "failed")
        {
            "failed"
        } else if cases.values().all(|x| x["status"] == "passed") {
            "passed"
        } else {
            "incomplete"
        };
        self.manifest["status"] = json!(status);
        self.manifest["exit_status"] = json!(if status == "passed" {
            0
        } else if status == "failed" {
            1
        } else {
            2
        });
        self.manifest["captured_at"] =
            json!(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true));
        fs::write(
            self.out.join("manifest.json"),
            serde_json::to_vec_pretty(&self.manifest)?,
        )?;
        Ok(())
    }
}
fn decode_view(raw: &Value) -> Result<Value> {
    let bytes: Vec<u8> = raw["result"]["result"]
        .as_array()
        .context("view failed or missing bytes")?
        .iter()
        .map(|v| {
            v.as_u64()
                .and_then(|n| u8::try_from(n).ok())
                .context("invalid view byte")
        })
        .collect::<Result<_>>()?;
    Ok(serde_json::from_slice(&bytes)?)
}
struct Fixture {
    owner: Account,
    worker: Account,
    session_id: String,
}
async fn actor(h: &mut Harness, label: &str, core: &AccountId, storage: u128) -> Result<Account> {
    let a = h
        .worker
        .root_account()?
        .create_subaccount(label)
        .initial_balance(NearToken::from_near(10))
        .transact()
        .await?
        .into_result()?;
    let raw = h
        .call(
            "deposit",
            a.call(core, "deposit")
                .args_json(json!({"storage_credit_yocto":storage.to_string()}))
                .deposit(NearToken::from_yoctonear((storage + NEAR).max(2 * NEAR))),
        )
        .await?;
    ensure!(success(&raw) && failures(&raw).is_empty(), "deposit failed");
    h.actor(label, &a);
    Ok(a)
}
struct OwnerSetup {
    storage: u128,
    daily: u128,
    purchase: u128,
    session_lifetime_ns: u64,
    requirement: Value,
    worker_allowance: NearToken,
}
impl OwnerSetup {
    fn standard(daily: u128) -> Self {
        Self {
            storage: NEAR / 4,
            daily,
            purchase: NEAR / 10,
            session_lifetime_ns: 86_400_000_000_000,
            requirement: Value::Null,
            worker_allowance: NearToken::from_millinear(50),
        }
    }
}
async fn owner(
    h: &mut Harness,
    label: &str,
    core: &AccountId,
    service: &AccountId,
    byte: u8,
    daily: u128,
) -> Result<Fixture> {
    owner_with(h, label, core, service, byte, OwnerSetup::standard(daily)).await
}
async fn owner_with(
    h: &mut Harness,
    label: &str,
    core: &AccountId,
    service: &AccountId,
    byte: u8,
    setup: OwnerSetup,
) -> Result<Fixture> {
    let account = actor(h, label, core, setup.storage).await?;
    h.manage(&account,core,"set_policy",json!({"expected_revision":0,"daily_cap_yocto":setup.daily.to_string(),"max_dispatches_per_minute":5,"paused":false})).await?;
    h.manage(
        &account,
        core,
        "set_profile",
        json!({"profile_id":"audit","expected_revision":null,"requirement":setup.requirement}),
    )
    .await?;
    let key = SecretKey::from_random(KeyType::ED25519);
    let session_id = id(byte);
    let now = h.timestamp().await?;
    h.manage(&account,core,"register_session",json!({"session_id":session_id,"public_key":key.public_key().to_string(),"profile_id":"audit","profile_revision":1,"purchase_cap_yocto":setup.purchase.to_string(),"expires_at_ns":(now+setup.session_lifetime_ns).to_string()})).await?;
    h.manage(&account,core,"set_service_trust",json!({"service_id":service,"service_version":1,"allowed_profile_ids":["audit"],"expires_at_ns":null,"active":true})).await?;
    let key_tx = account
        .batch(account.id())
        .add_key(
            key.public_key(),
            AccessKey::function_call_access(
                core,
                &["execute_payment"],
                Some(setup.worker_allowance),
            ),
        )
        .transact_async()
        .await?;
    let raw = h.final_tx("install-worker-key", key_tx).await?;
    ensure!(success(&raw), "key installation failed");
    let worker = Account::from_secret_key(account.id().clone(), key, &h.worker);
    h.manifest["actors"].as_array_mut().unwrap().push(json!({"role":label,"account_id":account.id(),"worker_public_key_sha256":hash(worker.secret_key().public_key().to_string().as_bytes())}));
    Ok(Fixture {
        owner: account,
        worker,
        session_id,
    })
}
async fn quote(
    h: &mut Harness,
    core: &AccountId,
    buyer: &Fixture,
    merchant: &AccountId,
    key: &near_crypto::SecretKey,
    byte: u8,
    amount: u128,
) -> Result<Value> {
    let now = h.timestamp().await?;
    let policy = h
        .view(core, "get_policy", json!({"owner_id":buyer.owner.id()}))
        .await?;
    let service = h
        .view(core, "get_service", json!({"service_id":merchant}))
        .await?;
    let invoice: InvoiceV1 = serde_json::from_value(
        json!({"schema_version":1,"network":"near:testnet","core_account":core,"owner_id":buyer.owner.id(),"session_id":buyer.session_id,"payment_id":id(byte),"policy_revision":policy["revision"],"profile_id":"audit","profile_revision":1,"service_id":merchant,"service_version":service["version"],"payout_account":service["payout_account"],"endpoint_hash":service["endpoint_hash"],"request_hash":id(99),"asset":"NEAR","amount_yocto":amount.to_string(),"issued_at_ns":now.to_string(),"expires_at_ns":(now+120_000_000_000).to_string()}),
    )?;
    signed(invoice, key)
}
fn signed(invoice: InvoiceV1, key: &near_crypto::SecretKey) -> Result<Value> {
    let signature = key.sign(&codec::encode_invoice(&invoice));
    let bytes = bs58::decode(
        signature
            .to_string()
            .split_once(':')
            .context("signature encoding")?
            .1,
    )
    .into_vec()?;
    Ok(json!({"invoice":invoice,"signature":STANDARD.encode(bytes)}))
}
async fn pay(
    h: &mut Harness,
    core: &AccountId,
    buyer: &Fixture,
    quote: &Value,
    label: &str,
) -> Result<Value> {
    h.call(
        label,
        buyer
            .worker
            .call(core, "execute_payment")
            .args_json(json!({"quote":quote,"credential":null})),
    )
    .await
}
async fn payment(h: &mut Harness, core: &AccountId, buyer: &Fixture, byte: u8) -> Result<Value> {
    h.view(
        core,
        "get_payment",
        json!({"owner_id":buyer.owner.id(),"payment_id":id(byte)}),
    )
    .await
}
async fn ledger(h: &mut Harness, core: &AccountId, buyer: &Fixture) -> Result<Value> {
    h.view(core, "get_account", json!({"account_id":buyer.owner.id()}))
        .await
}
fn rejection(raw: &Value, code: &str) -> bool {
    returned(raw).is_ok_and(|r| r["kind"] == "rejected" && r["decision"]["code"] == code)
}

async fn run(
    h: &mut Harness,
    wasm: &[u8],
    fault: Option<&[u8]>,
    helper: Option<&[u8]>,
) -> Result<()> {
    let core_account = h
        .worker
        .root_account()?
        .create_subaccount("core")
        .initial_balance(NearToken::from_near(10))
        .transact()
        .await?
        .into_result()?;
    let deploy = core_account
        .batch(core_account.id())
        .deploy(wasm)
        .transact_async()
        .await?;
    ensure!(
        success(&h.final_tx("deploy-core", deploy).await?),
        "deploy failed"
    );
    let core = core_account.id().clone();
    h.manifest["core_account"] = json!(core);
    h.actor("core-deployer", &core_account);
    let start = h.start();
    let attacker = h
        .worker
        .root_account()?
        .create_subaccount("attacker")
        .initial_balance(NearToken::from_near(10))
        .transact()
        .await?
        .into_result()?;
    h.actor("attacker", &attacker);
    let args = json!({"network":"near:testnet","operating_reserve_yocto":NEAR.to_string()});
    let bad = h
        .call(
            "unauthorized-initialization",
            attacker.call(&core, "new").args_json(args.clone()),
        )
        .await?;
    let good = h
        .call(
            "authorized-initialization",
            core_account.call(&core, "new").args_json(args),
        )
        .await?;
    let code = h.balance(&core).await?;
    h.case(
        "initialization_authority",
        start,
        vec![
            ("foreign first caller rejected", !success(&bad)),
            ("contract account initializes", success(&good)),
            (
                "deployed code hash matches inspected bytes",
                code["code_hash"] == bs58::encode(Sha256::digest(wasm)).into_string(),
            ),
        ],
        &[],
    );
    ensure!(
        success(&good),
        "cannot continue after failed initialization"
    );
    let merchant = actor(h, "merchant", &core, NEAR / 4).await?;
    let recipient = h
        .worker
        .root_account()?
        .create_subaccount("payee")
        .initial_balance(NearToken::from_near(1))
        .transact()
        .await?
        .into_result()?;
    h.actor("payee", &recipient);
    let merchant_key = near_crypto::SecretKey::from_random(near_crypto::KeyType::ED25519);
    let public = bs58::decode(
        merchant_key
            .public_key()
            .to_string()
            .split_once(':')
            .context("key encoding")?
            .1,
    )
    .into_vec()?;
    h.manage(&merchant,&core,"set_service",json!({"expected_version":null,"payout_account":recipient.id(),"invoice_key":STANDARD.encode(&public),"endpoint_hash":id(77),"active":true})).await?;
    let buyer = owner(h, "buyer", &core, merchant.id(), 1, NEAR / 20).await?;
    let start = h.start();
    let permission_request = json!({"request_type":"view_access_key","account_id":buyer.owner.id(),"public_key":buyer.worker.secret_key().public_key().to_string(),"finality":"final"});
    let permissions = h.rpc("query", permission_request.clone()).await?;
    h.artifact(
        "worker-permission",
        "final_access_key",
        &json!({"request":permission_request,"response":permissions}),
    )?;
    let p = &permissions["result"]["permission"]["FunctionCall"];
    let mut checks = vec![
        ("exact receiver", p["receiver_id"] == core.as_str()),
        (
            "singleton execute_payment method",
            p["method_names"] == json!(["execute_payment"]),
        ),
        (
            "finite nonzero allowance",
            decimal(&p["allowance"]).is_ok_and(|n| n > 0 && n <= NEAR / 20),
        ),
    ];
    // A transport error is not a permission proof: require the actual access-key error class.
    for (name, expected, call) in [
        (
            "owner method",
            KeyRejection::MethodNameMismatch,
            buyer.worker.call(&core, "set_policy").args_json(json!({})),
        ),
        (
            "wrong receiver",
            KeyRejection::ReceiverMismatch,
            buyer
                .worker
                .call(attacker.id(), "execute_payment")
                .args_json(json!({})),
        ),
        (
            "attached deposit",
            KeyRejection::DepositWithFunctionCall,
            buyer
                .worker
                .call(&core, "execute_payment")
                .args_json(json!({}))
                .deposit(NearToken::from_yoctonear(1)),
        ),
    ] {
        // The async RPC method has an empty error enum and may discard a
        // structured rejection in parsing. Only these intentionally invalid
        // probes use the synchronous method's typed RpcTransactionError.
        let (actual, evidence) = match call.transact().await {
            Err(error) => rejection_evidence(&error),
            Ok(result) => (
                None,
                json!({"unexpected_execution_result":format!("{result:?}"),"classification":null}),
            ),
        };
        h.artifact(
            "key-rejection",
            "rpc_rejection",
            &json!({"attempt":name,"expected":expected.label(),"evidence":evidence}),
        )?;
        checks.push((name, actual == Some(expected)));
    }
    for (name, tx) in [
        (
            "native transfer",
            buyer
                .worker
                .batch(recipient.id())
                .transfer(NearToken::from_yoctonear(1)),
        ),
        (
            "key management",
            buyer
                .worker
                .batch(buyer.owner.id())
                .delete_key(buyer.worker.secret_key().public_key()),
        ),
    ] {
        let (actual, evidence) = match tx.transact().await {
            Err(error) => rejection_evidence(&error),
            Ok(result) => (
                None,
                json!({"unexpected_execution_result":format!("{result:?}"),"classification":null}),
            ),
        };
        h.artifact("key-action-rejection","rpc_rejection",&json!({"attempt":name,"expected":KeyRejection::RequiresFullAccess.label(),"evidence":evidence}))?;
        checks.push((name, actual == Some(KeyRejection::RequiresFullAccess)));
    }
    h.case("restricted_key", start, checks, &[]);
    let q = quote(
        h,
        &core,
        &buyer,
        merchant.id(),
        &merchant_key,
        10,
        NEAR / 100,
    )
    .await?;
    let start = h.start();
    let wrong_key = h
        .call(
            "owner-full-key-is-not-session",
            buyer
                .owner
                .call(&core, "execute_payment")
                .args_json(json!({"quote":q,"credential":null})),
        )
        .await?;
    let wrong_owner = h
        .call(
            "wrong-owner",
            attacker
                .call(&core, "execute_payment")
                .args_json(json!({"quote":q,"credential":null})),
        )
        .await?;
    let untouched = payment(h, &core, &buyer, 10).await?;
    h.case("actual_signer",start,vec![("same account wrong actual key rejected",!success(&wrong_key)||rejection(&wrong_key,"UNAUTHORIZED")),("different actual owner rejected",!success(&wrong_owner)||rejection(&wrong_owner,"UNAUTHORIZED")),("no payment allocated",untouched.is_null())],&["Relayed predecessor is covered by the separate optional helper case; session/profile mutations are exercised separately."]);
    let start = h.start();
    let before = h.balance(recipient.id()).await?;
    let before_ledger = ledger(h, &core, &buyer).await?;
    let mut forged = q.clone();
    forged["invoice"]["amount_yocto"] = json!((NEAR / 100 + 1).to_string());
    let rejected = pay(h, &core, &buyer, &forged, "forged-invoice").await?;
    let paid = pay(h, &core, &buyer, &q, "signed-payment").await?;
    let record = payment(h, &core, &buyer, 10).await?;
    let after = h.balance(recipient.id()).await?;
    let after_ledger = ledger(h, &core, &buyer).await?;
    let v = &after_ledger["vault"];
    let backed = decimal(&v["runtime_account_balance_yocto"])?
        >= decimal(&v["storage_usage_bytes"])? * decimal(&v["storage_byte_cost_yocto"])?
            + decimal(&v["total_available_yocto"])?
            + decimal(&v["total_storage_credit_yocto"])?
            + decimal(&v["operating_reserve_yocto"])?;
    let dispatch = committed_event(&paid, &core, "payment_dispatched", &id(10))?;
    let backing = &dispatch["backing"];
    let expected_required = decimal(&backing["storage_usage_after_charge_bytes"])?
        * decimal(&backing["storage_byte_cost_yocto"])?
        + decimal(&backing["operating_reserve_yocto"])?
        + decimal(&backing["total_available_after_reservation_yocto"])?
        + decimal(&backing["total_storage_credit_after_charge_yocto"])?
        + NEAR / 100;
    let core_after = h.balance(&core).await?;
    let invoice: InvoiceV1 = serde_json::from_value(q["invoice"].clone())?;
    h.case(
        "signed_dispatch",
        start,
        vec![
            (
                "mutated signed amount rejected",
                rejection(&rejected, "INVALID_INVOICE"),
            ),
            (
                "all receipts final and successful",
                success(&paid) && failures(&paid).is_empty(),
            ),
            (
                "payment settled and immutable invoice bound",
                record["state"] == "settled"
                    && record["invoice"] == q["invoice"]
                    && record["invoice_hash"] == STANDARD.encode(codec::invoice_hash(&invoice)),
            ),
            (
                "payee credited exact native amount",
                decimal(&after["amount"])? - decimal(&before["amount"])? == NEAR / 100,
            ),
            (
                "available debited exact amount",
                decimal(&before_ledger["available_yocto"])?
                    - decimal(&after_ledger["available_yocto"])?
                    == NEAR / 100,
            ),
            (
                "actual host balance deducted at explicit scheduling",
                decimal(&backing["runtime_balance_before_schedule_yocto"])?
                    .checked_sub(decimal(&backing["runtime_balance_after_schedule_yocto"])?)
                    == Some(NEAR / 100),
            ),
            (
                "pre-transfer guard covers storage and undebited transfer",
                decimal(&backing["required_before_transfer_yocto"])? == expected_required
                    && decimal(&backing["runtime_balance_before_schedule_yocto"])?
                        >= expected_required,
            ),
            (
                "callback and final serialization did not add unpriced storage",
                decimal(&backing["storage_usage_after_charge_bytes"])?
                    == u128::from(
                        core_after["storage_usage"]
                            .as_u64()
                            .context("storage usage")?,
                    ),
            ),
            ("final serialized state has backing", backed),
        ],
        &["The actual no-surplus refund-gap rejection remains a separate incomplete case."],
    );
    let start = h.start();
    let retry = pay(h, &core, &buyer, &q, "exact-retry").await?;
    let mut conflict = q.clone();
    conflict["invoice"]["request_hash"] = json!(id(98));
    let conflicting = pay(h, &core, &buyer, &conflict, "id-conflict").await?;
    let retried = payment(h, &core, &buyer, 10).await?;
    let last = h.balance(recipient.id()).await?;
    h.case(
        "replay_conflict",
        start,
        vec![
            (
                "retry reports duplicate",
                returned(&retry)?["duplicate"] == true,
            ),
            ("immutable record retained", record == retried),
            (
                "changed tuple conflicts before signature",
                rejection(&conflicting, "PAYMENT_ID_CONFLICT"),
            ),
            ("retry pays nothing", last["amount"] == after["amount"]),
        ],
        &[],
    );
    let cap = owner(h, "cap", &core, merchant.id(), 2, NEAR / 20).await?;
    let start = h.start();
    // Separate keys avoid client nonce races; both sessions share the same owner cap.
    let second = SecretKey::from_random(KeyType::ED25519);
    let now = h.timestamp().await?;
    h.manage(&cap.owner,&core,"register_session",json!({"session_id":id(3),"public_key":second.public_key().to_string(),"profile_id":"audit","profile_revision":1,"purchase_cap_yocto":(NEAR/10).to_string(),"expires_at_ns":(now+86_400_000_000_000).to_string()})).await?;
    let tx = cap
        .owner
        .batch(cap.owner.id())
        .add_key(
            second.public_key(),
            AccessKey::function_call_access(
                &core,
                &["execute_payment"],
                Some(NearToken::from_millinear(50)),
            ),
        )
        .transact_async()
        .await?;
    h.final_tx("second-worker-key", tx).await?;
    let sibling = Fixture {
        owner: cap.owner.clone(),
        worker: Account::from_secret_key(cap.owner.id().clone(), second, &h.worker),
        session_id: id(3),
    };
    // Session registration increments policy revision, so create both quotes after it.
    let qa = quote(
        h,
        &core,
        &cap,
        merchant.id(),
        &merchant_key,
        20,
        3 * NEAR / 100,
    )
    .await?;
    let qb = quote(
        h,
        &core,
        &sibling,
        merchant.id(),
        &merchant_key,
        21,
        3 * NEAR / 100,
    )
    .await?;
    let (a, b) = tokio::join!(
        cap.worker
            .call(&core, "execute_payment")
            .args_json(json!({"quote":qa,"credential":null}))
            .max_gas()
            .transact_async(),
        sibling
            .worker
            .call(&core, "execute_payment")
            .args_json(json!({"quote":qb,"credential":null}))
            .max_gas()
            .transact_async()
    );
    let a = h.final_tx("concurrent-a", a?).await?;
    let b = h.final_tx("concurrent-b", b?).await?;
    let pa = payment(h, &core, &cap, 20).await?;
    let pb = payment(h, &core, &cap, 21).await?;
    h.case(
        "concurrent_cap",
        start,
        vec![
            (
                "exactly one reservation retained",
                (!pa.is_null()) ^ (!pb.is_null()),
            ),
            (
                "other request denied by owner-wide day cap",
                rejection(&a, "DAILY_CAP") ^ rejection(&b, "DAILY_CAP"),
            ),
        ],
        &[],
    );
    let start = h.start();
    let fake = h
        .call(
            "public-fake-callback",
            attacker
                .call(&core, "on_payment_result")
                .args_json(json!({"owner_id":buyer.owner.id(),"payment_id":id(10)})),
        )
        .await?;
    let unchanged = payment(h, &core, &buyer, 10).await?;
    h.case("private_callback",start,vec![("public predecessor rejected",!success(&fake)),("terminal record unchanged",unchanged==record)],&["Duplicate internal callback outcomes are covered by pure transitions; repeated protocol callback injection is not simulated as a real receipt."]);
    // A named nonexistent destination forces a native transfer failure; implicit account IDs could be created instead.
    let failed_merchant = actor(h, "failedmerchant", &core, NEAR / 4).await?;
    let absent: AccountId = format!("missing.{}", h.worker.root_account()?.id()).parse()?;
    h.manage(&failed_merchant,&core,"set_service",json!({"expected_version":null,"payout_account":absent,"invoice_key":STANDARD.encode(&public),"endpoint_hash":id(77),"active":true})).await?;
    let failed_buyer = owner(h, "failedbuyer", &core, failed_merchant.id(), 4, NEAR / 20).await?;
    let qf = quote(
        h,
        &core,
        &failed_buyer,
        failed_merchant.id(),
        &merchant_key,
        30,
        NEAR / 100,
    )
    .await?;
    let start = h.start();
    let lb = ledger(h, &core, &failed_buyer).await?;
    let failed = pay(h, &core, &failed_buyer, &qf, "failed-native-transfer").await?;
    let pf = payment(h, &core, &failed_buyer, 30).await?;
    let la = ledger(h, &core, &failed_buyer).await?;
    let failed_retry = pay(h, &core, &failed_buyer, &qf, "failed-retry").await?;
    let lr = ledger(h, &core, &failed_buyer).await?;
    h.case("failed_transfer",start,vec![("native transfer receipt failed",!failures(&failed).is_empty()),("record finalized failed",pf["state"]=="failed"),("claim restored once",lb["available_yocto"]==la["available_yocto"]&&la["available_yocto"]==lr["available_yocto"]),("retry is immutable failed record",returned(&failed_retry)?["duplicate"]==true),("failed attempt retained",la["usage"]["dispatched_in_minute"]==1&&lr["usage"]["dispatched_in_minute"]==1),("no pending or outstanding principal after definitive failure",la["pending_payment_yocto"]=="0"&&la["usage"]["outstanding_transfers"]==0)],&["Refund-gap liquidity rejection requires an actual measured shortfall and remains unavailable in refund_gap; final refund completion alone is insufficient."]);
    let start = h.start();
    let wb = ledger(h, &core, &buyer).await?;
    let withdrawn = h
        .manage(
            &buyer.owner,
            &core,
            "withdraw_available",
            json!({"withdrawal_id":id(40),"amount_yocto":(NEAR/100).to_string()}),
        )
        .await?;
    let view = h
        .view(
            &core,
            "get_withdrawal",
            json!({"owner_id":buyer.owner.id(),"withdrawal_id":id(40)}),
        )
        .await?;
    let wa = ledger(h, &core, &buyer).await?;
    let repeat = h
        .manage(
            &buyer.owner,
            &core,
            "withdraw_available",
            json!({"withdrawal_id":id(40),"amount_yocto":(NEAR/100).to_string()}),
        )
        .await?;
    let wr = ledger(h, &core, &buyer).await?;
    h.case("withdrawal",start,vec![("dispatch returns pending",withdrawn["state"]=="pending"),("withdrawal reaches owner success",view["state"]=="succeeded"&&view["owner_id"]==buyer.owner.id().as_str()&&view["payout_account"]==buyer.owner.id().as_str()),("available debited once",decimal(&wb["available_yocto"])?.checked_sub(decimal(&wa["available_yocto"])?)==Some(NEAR/100)&&wa["available_yocto"]==wr["available_yocto"]),("retry returns original success",repeat["state"]=="succeeded")],&["Owner balance delta includes transaction gas; immutable owner destination and transfer receipt must be inspected. The deleted-owner failure scenario is covered by the separate optional helper case."]);
    if let Some(helper) = helper {
        helper_cases::run(
            h,
            &core,
            merchant.id(),
            &merchant_key,
            recipient.id(),
            helper,
        )
        .await?;
    }
    matrix::run(h, &core, merchant.id(), &merchant_key, recipient.id()).await?;
    let retained_capacity =
        matrix::retained_capacity(h, &core, merchant.id(), &merchant_key, recipient.id()).await?;
    if let Some(fault) = fault {
        let start = h.start();
        let deploy = core_account
            .batch(&core)
            .deploy(fault)
            .transact_async()
            .await?;
        ensure!(
            success(&h.final_tx("deploy-callback-fault", deploy).await?),
            "fault deploy failed"
        );
        let observed = h.balance(&core).await?;
        ensure!(
            observed["code_hash"] == bs58::encode(Sha256::digest(fault)).into_string(),
            "wrong fault artifact"
        );
        let qfault = quote(
            h,
            &core,
            &buyer,
            merchant.id(),
            &merchant_key,
            50,
            NEAR / 100,
        )
        .await?;
        let before = h.balance(recipient.id()).await?;
        let lb = ledger(h, &core, &buyer).await?;
        let paid = pay(h, &core, &buyer, &qfault, "payout-with-failed-callback").await?;
        let original = payment(h, &core, &buyer, 50).await?;
        let after = h.balance(recipient.id()).await?;
        let la = ledger(h, &core, &buyer).await?;
        let retry = pay(h, &core, &buyer, &qfault, "fault-retry").await?;
        let end = h.balance(recipient.id()).await?;
        // Explicit local clock acceleration is a user-run Sandbox operation, not a normal view.
        for _ in 0..4 {
            if h.timestamp().await?
                > original["dispatched_at_ns"]
                    .as_str()
                    .context("dispatch time")?
                    .parse::<u64>()?
                    + 120_000_000_000
            {
                break;
            }
            h.worker.fast_forward(250).await?;
        }
        let timed_out = payment(h, &core, &buyer, 50).await?;
        let after_timeout = ledger(h, &core, &buyer).await?;
        h.case("callback_failure",start,vec![("payee credited",decimal(&after["amount"])?.checked_sub(decimal(&before["amount"])?)==Some(NEAR/100)),("callback failure observed",failures(&paid).iter().any(|r|r["outcome"]["executor_id"]==core.as_str())),("reservation remains pending",original["state"]=="pending"),("available claim stays debited",decimal(&lb["available_yocto"])?.checked_sub(decimal(&la["available_yocto"])?)==Some(NEAR/100)),("retry does not pay again",returned(&retry)?["duplicate"]==true&&after["amount"]==end["amount"]),("timeout is diagnostic only",timed_out["state"]=="pending"&&timed_out["display_state"]=="needs_reconciliation"&&after_timeout["available_yocto"]==la["available_yocto"]&&after_timeout["pending_payment_yocto"]==la["pending_payment_yocto"])],&["Injected failure uses a separately hashed default-off build. It does not establish production callback failure frequency or historical recovery."]);
        matrix::pending_capacity(
            h,
            &core_account,
            merchant.id(),
            &merchant_key,
            recipient.id(),
            wasm,
            retained_capacity,
        )
        .await?;
    }
    Ok(())
}

fn measured_version(program: &str) -> Result<String> {
    let output = std::process::Command::new(program)
        .arg("--version")
        .output()?;
    ensure!(output.status.success(), "{program} --version failed");
    Ok(String::from_utf8(output.stdout)?.trim().to_owned())
}
#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    ensure!(
        args.first().map(String::as_str) == Some("--user-run"),
        "USER-RUN ONLY: use the reviewed scripts/run-runtime.mjs launcher; this creates a Sandbox database"
    );
    ensure!(
        args.len() >= 3 && args.len() % 2 == 1,
        "expected --user-run <production.wasm> <output-directory> [--fault-wasm path] [--helper-wasm path]"
    );
    let mut options = BTreeMap::new();
    for pair in args[3..].chunks_exact(2) {
        ensure!(
            ["--fault-wasm", "--helper-wasm"].contains(&pair[0].as_str())
                && options.insert(pair[0].as_str(), pair[1].as_str()).is_none(),
            "invalid or duplicate runtime option"
        );
    }
    let binary = std::env::var("NEAR_SANDBOX_BIN_PATH").context(
        "explicit existing NEAR_SANDBOX_BIN_PATH required; automatic installation prohibited",
    )?;
    ensure!(
        Path::new(&binary).is_absolute() && Path::new(&binary).is_file(),
        "Sandbox binary must be an existing absolute path"
    );
    let wasm = fs::read(&args[1])?;
    let fault = options.get("--fault-wasm").map(fs::read).transpose()?;
    let helper = options.get("--helper-wasm").map(fs::read).transpose()?;
    if let Some(ref bytes) = helper {
        ensure!(
            hash(bytes) != hash(&wasm)
                && fault
                    .as_ref()
                    .is_none_or(|fault| hash(bytes) != hash(fault)),
            "helper artifact must differ from production and callback-fault builds"
        );
        ensure!(
            bytes
                .windows(b"AGENTTRUST_RUNTIME_HELPER_ONLY".len())
                .any(|window| window == b"AGENTTRUST_RUNTIME_HELPER_ONLY"),
            "missing runtime helper artifact marker"
        );
    }
    if let Some(ref bytes) = fault {
        ensure!(
            hash(bytes) != hash(&wasm),
            "fault artifact must differ from production"
        );
    }
    let out = PathBuf::from(&args[2]);
    ensure!(
        !out.exists(),
        "output directory must be new; do not overwrite recorded evidence"
    );
    fs::create_dir_all(out.join("raw"))?;
    let mut cases = BTreeMap::new();
    for (name, ids) in REQUIRED_CASES {
        cases.insert(*name,json!({"status":"not_run","verification_ids":ids,"assertions":[],"artifacts":[],"limitations":["Not executed in this capture"]}));
    }
    cases.insert("refund_gap",json!({"status":"unavailable","verification_ids":["V17"],"assertions":[],"artifacts":[],"limitations":["This runner does not force a no-surplus intermediate refund gap. Final snapshots cannot establish its liquidity denial. Keep V17 runtime ordering gate open until a dedicated captured receipt experiment exists."]}));
    cases.insert("midnight_and_edits",json!({"status":"not_run","verification_ids":["V15"],"assertions":[],"artifacts":[],"limitations":["Pure original-day accounting tests exist; controlled midnight callback ordering is not yet implemented here."]}));
    let commit = String::from_utf8(
        std::process::Command::new("git")
            .args(["rev-parse", "HEAD"])
            .output()?
            .stdout,
    )?
    .trim()
    .to_owned();
    let dirty = !std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .output()?
        .stdout
        .is_empty();
    let command = std::env::var("AGENTTRUST_RUNTIME_COMMAND")
        .unwrap_or_else(|_| "direct runtime binary invocation".into());
    let toolchain = json!({"measured":{"rustc_version":measured_version("rustc")?,"cargo_version":measured_version("cargo")?},"configured_pins":{"rust":"1.97.1","near_workspaces":"0.24.0","near_sdk":"5.30.1"},"runtime_lock_sha256":hash(&fs::read("tests/runtime/Cargo.lock")?)});
    // This is the first operation that starts a persistent database. Never invoke in an agent turn.
    let worker = near_workspaces::sandbox().await?;
    let rpc = reqwest::Client::builder()
        .timeout(Duration::from_secs(40))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let manifest = json!({"schema_version":2,"kind":"agenttrust_native_runtime","status":"incomplete","captured_at":chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs,true),"git_commit":commit,"working_tree_dirty":dirty,"environment":{"kind":"sandbox","protocol_network":"near:testnet","rpc_url":worker.rpc_addr()},"toolchain":toolchain,"production_wasm_sha256":hash(&wasm),"fault_wasm_sha256":fault.as_ref().map(|b|hash(b)),"helper_wasm_sha256":helper.as_ref().map(|b|hash(b)),"sandbox_binary_sha256":hash(&fs::read(&binary)?),"command":command,"exit_status":2,"actors":[],"artifacts":[],"cases":cases,"limitations":["Local Sandbox evidence is not testnet evidence, a production custody audit, or an independent proof of provider quality.","The read-only checker verifies capture structure and local artifact integrity; it does not make RPC responses into a light-client proof."]});
    let mut h = Harness {
        worker,
        rpc,
        out,
        manifest,
        sequence: 0,
    };
    let status = h.rpc("status", json!([])).await?;
    h.artifact("node-status", "node_status", &status)?;
    h.manifest["environment"]["reported_chain_id"] = status["result"]["chain_id"].clone();
    h.manifest["environment"]["node_version"] = status["result"]["version"].clone();
    if let Err(error) = run(&mut h, &wasm, fault.as_deref(), helper.as_deref()).await {
        h.manifest["fatal_error"] = json!(error.to_string());
    }
    h.save()?;
    println!(
        "{} {}",
        h.manifest["status"],
        h.out.join("manifest.json").display()
    );
    let exit_status = h.manifest["exit_status"].as_i64().unwrap() as i32;
    drop(h); // Run Sandbox/Child destructors before exiting, including on failure.
    std::process::exit(exit_status)
}
