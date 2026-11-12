/** Explicit user-run setup only. Importing this module never reads keys or sends a transaction. */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Account, KeyPairSigner, actions, baseEncode, type KeyPairString } from "near-api-js";
import { AgentTrustClient, bounded, CALL_GAS } from "../../../packages/near-sdk/src/client.js";
import { AgentTrustOwner } from "../../../packages/near-sdk/src/owner.js";
import { validateService } from "../../invoice-audit/src/validate.js";
import { argumentsFor, catalog, limits, publicTemplate, readConfig, renderPublicConfigs, requirement, service, sha256, type DemoConfig } from "./config.js";
import { Capture, ensure, safeError } from "./capture.js";
import { OperationJournal } from "./operations.js";
export const setupSteps = ["deploy-core", "owner-deposit", "issuer-deposit", "provider-a-deposit", "provider-b-deposit", "provider-a-register", "provider-b-register", "owner-profile", "owner-trust-a", "owner-trust-b", "owner-session", "owner-worker-key", "owner-policy", "validate-b", "issuer-issue-b", "issuer-revoke-b", "provider-b-rotate"] as const;
export const setupUsage = "Usage: pnpm demo:prepare:testnet -- --user-run --config /absolute/demo.json --output artifacts/local/testnet/NEW_STEP --step NAME\n--template prints an incomplete public configuration; --render-config /absolute/demo.json prints public provider/MCP configs.\nPrefix a mutating step with observe- to inspect its saved transaction without a signer or rebroadcast.\nEvery operational step is user-run only. Steps: " + setupSteps.join(", ");
export function setupAccount(c: DemoConfig, step: string): string {
  if (step === "deploy-core") return c.core_account;
  if (step.startsWith("owner-")) return c.owner_id;
  if (step.startsWith("issuer-")) return c.issuer_id;
  if (step.startsWith("provider-a-")) return c.providers.a.service_id;
  if (step.startsWith("provider-b-")) return c.providers.b.service_id;
  throw new Error("NO_SETUP_SIGNER_FOR_STEP");
}
async function captureState(capture: Capture, client: AgentTrustClient, c: DemoConfig, step: string): Promise<void> {
  if (step === "owner-worker-key") {
    await capture.query(client, "setup-state.json", { request_type: "view_access_key", account_id: c.owner_id, public_key: c.worker_public_key, finality: "final" }); return;
  }
  const actor = setupAccount(c, step);
  const [method, args] = step.endsWith("-deposit") ? ["get_account", { account_id: actor }] : step.includes("register") || step.includes("rotate") ? ["get_service", { service_id: actor }] : step.includes("issue") || step.includes("revoke") ? ["get_credential", { issuer_id: c.issuer_id, credential_id: c.credential_id }] : step === "owner-profile" ? ["get_profile", { owner_id: c.owner_id, profile_id: c.profile_id }] : step === "owner-session" ? ["get_session", { owner_id: c.owner_id, session_id: c.session_id }] : step === "deploy-core" ? ["get_config", {}] : ["get_policy", { owner_id: c.owner_id }];
  await capture.query(client, "setup-state.json", { request_type: "call_function", account_id: c.core_account, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64"), finality: "final" });
}
async function deploy(c: DemoConfig, client: AgentTrustClient, signer: KeyPairSigner, capture: Capture, beforeBroadcast: Capture["beforeBroadcast"]) {
  const status = await bounded(client.provider.sendJsonRpc("status", []));
  ensure(status.chain_id === "testnet", "DOMAIN_MISMATCH");
  const before = await capture.query(client, "core-before-deploy.json", { request_type: "view_account", account_id: c.core_account, finality: "final" }) as { code_hash: string };
  ensure(before.code_hash === baseEncode(Buffer.alloc(32)), "CORE_ALREADY_HAS_CODE");
  const wasm = await readFile("target/wasm32-unknown-unknown/release/agenttrust_core.wasm");
  ensure(sha256(wasm) === c.expected_wasm_sha256 && !wasm.includes(Buffer.from("RUNTIME_TEST_CALLBACK_FAILURE")), "PRODUCTION_WASM_MISMATCH");
  const key = await signer.getPublicKey();
  const access = await client.provider.viewAccessKey({ accountId: c.core_account, publicKey: key, finalityQuery: { finality: "final" } });
  ensure(access.permission === "FullAccess", "OWNER_FULL_ACCESS_KEY_REQUIRED");
  const account = new Account(c.core_account, client.provider, signer);
  const tx = await account.createTransaction({ receiverId: c.core_account, publicKey: key, actions: [actions.deployContract(wasm), actions.functionCall("new", { network: c.network, operating_reserve_yocto: limits.operating_reserve }, CALL_GAS, 0n)] });
  const signed = await signer.signTransaction(tx);
  const transaction = { tx_hash: baseEncode(signed.txHash), sender_account_id: c.core_account };
  await beforeBroadcast(transaction);
  try { await bounded(client.provider.sendTransactionUntil(signed.signedTransaction, "FINAL")); }
  catch { return { kind: "uncertain" as const, transaction }; }
  await capture.transaction(client, transaction);
  await capture.checkCore(client);
  return { kind: "final" as const, transaction };
}
export async function runPreparation(argv: readonly string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") { console.log(setupUsage); return; }
  if (argv.length === 1 && argv[0] === "--template") { console.log(JSON.stringify(publicTemplate(), null, 2)); return; }
  if (argv.length === 2 && argv[0] === "--render-config") { console.log(JSON.stringify(renderPublicConfigs(await readConfig(argv[1]!)), null, 2)); return; }
  const args = argumentsFor(argv, [...setupSteps, ...setupSteps.filter((s) => s !== "validate-b").map((s) => `observe-${s}`)]); // Must precede config, key, network and file effects.
  const c = await readConfig(args.config);
  const capture = await Capture.start(args.output, c, args.command, `pnpm demo:prepare:testnet -- ${argv.map((a) => JSON.stringify(a)).join(" ")}`);
  let key: string | undefined;
  try {
    const client = new AgentTrustClient({ network: c.network, coreAccount: c.core_account, rpcUrl: c.rpc_url, catalog: catalog(c) });
    if (args.command.startsWith("observe-")) {
      const step = args.command.slice("observe-".length);
      const journal = new OperationJournal(c, step, setupAccount(c, step));
      const transaction = await journal.existing();
      ensure(transaction, "SAVED_SETUP_TRANSACTION_REQUIRED");
      const status = await bounded(client.provider.sendJsonRpc("status", []));
      ensure(status.chain_id === "testnet", "DOMAIN_MISMATCH");
      await capture.beforeBroadcast(transaction); // Recorded locator only; this branch never signs or sends.
      await capture.transaction(client, transaction);
      await captureState(capture, client, c, step);
      await capture.finish("prepared", { observed_transaction: transaction, action: "Inspect FINAL transaction status and resulting contract state; this does not rerun or certify the original step.", broadcast: false });
      return;
    }
    if (args.command !== "deploy-core") await capture.checkCore(client);
    const validation = async () => {
      const result = await validateService(c.providers.b.service_id, { network: c.network, core_account: c.core_account, issuer_id: c.issuer_id, catalog: catalog(c), credential_expires_at_ns: c.credential_expires_at_ns, readService: (id) => client.getService(id) });
      await capture.put("validation.json", "validator_result", result);
      ensure(result.ok, "VALIDATION_DID_NOT_PASS"); return result;
    };
    if (args.command === "validate-b") { await capture.finish("prepared", await validation()); return; }
    ensure(!process.env.AGENTTRUST_WORKER_PRIVATE_KEY, "MIXED_ROLE_KEYS_FORBIDDEN");
    const secret = process.env.AGENTTRUST_SETUP_PRIVATE_KEY;
    ensure(typeof secret === "string" && secret.startsWith("ed25519:"), "SETUP_KEY_REQUIRED");
    const signer = KeyPairSigner.fromSecretKey(secret as KeyPairString);
    key = (await signer.getPublicKey()).toString();
    const account = setupAccount(c, args.command);
    ensure(key !== c.worker_public_key, "WORKER_CANNOT_RUN_SETUP");
    const journal = new OperationJournal(c, args.command, account);
    ensure(await journal.existing() === null, "SAVED_SETUP_TRANSACTION_USE_OBSERVE");
    const options = { beforeBroadcast: async (transaction: Parameters<Capture["beforeBroadcast"]>[0]) => { await journal.claim(transaction); await capture.beforeBroadcast(transaction); } };
    const owner = new AgentTrustOwner(client, account, signer);
    let result: unknown;
    if (args.command === "deploy-core") result = await deploy(c, client, signer, capture, options.beforeBroadcast);
    else if (args.command.endsWith("-deposit")) {
      ensure(await client.getAccount(account) === null, "ACTOR_ALREADY_FUNDED_DO_NOT_REPEAT");
      result = await owner.deposit(account === c.owner_id ? limits.owner_deposit : limits.registry_deposit, account === c.owner_id ? limits.owner_storage : limits.registry_deposit, options);
    } else if (args.command.endsWith("-register")) {
      const label = args.command === "provider-a-register" ? "a" : "b";
      ensure(await client.getService(account) === null, "SERVICE_ALREADY_REGISTERED");
      const { service_id: _id, version: _version, ...identity } = service(c, label);
      result = await owner.setService({ expected_version: null, ...identity }, options);
    } else if (args.command === "owner-profile") {
      ensure(await client.getProfile(account, c.profile_id) === null, "PROFILE_ALREADY_EXISTS");
      result = await owner.setProfile({ profile_id: c.profile_id, expected_revision: null, requirement: requirement(c) }, options);
    } else if (args.command === "owner-trust-a" || args.command === "owner-trust-b") {
      const p = c.providers[args.command === "owner-trust-a" ? "a" : "b"];
      const policy = await client.getPolicy(account);
      ensure(policy && !policy.trusted_services.some((s) => s.service_id === p.service_id), "TRUST_ALREADY_CONFIGURED");
      result = await owner.setServiceTrust({ service_id: p.service_id, service_version: 1, allowed_profile_ids: [c.profile_id], expires_at_ns: c.session_expires_at_ns, active: true }, options);
    } else if (args.command === "owner-session") {
      const profile = await client.getProfile(account, c.profile_id);
      ensure(profile && await client.getSession(account, c.session_id) === null && BigInt(c.session_expires_at_ns) > BigInt(Date.now()) * 1_000_000n, "NEW_ACTIVE_SESSION_REQUIRED");
      result = await owner.registerSession({ session_id: c.session_id, public_key: c.worker_public_key, profile_id: c.profile_id, profile_revision: profile.revision, purchase_cap_yocto: limits.purchase_cap, expires_at_ns: c.session_expires_at_ns }, options);
    } else if (args.command === "owner-worker-key") result = await owner.installWorkerKey(c.worker_public_key, limits.key_allowance, options);
    else if (args.command === "owner-policy") {
      const policy = await client.getPolicy(account);
      ensure(policy && policy.paused, "INITIAL_PAUSED_POLICY_REQUIRED");
      result = await owner.setPolicy({ expected_revision: policy.revision, daily_cap_yocto: limits.daily_cap, max_dispatches_per_minute: limits.rate, paused: false }, options);
    } else if (args.command === "issuer-issue-b") {
      ensure(await client.getCredential(c.issuer_id, c.credential_id) === null, "CREDENTIAL_ALREADY_EXISTS");
      const draft = await validation(); // Fresh bounded validation; the explicit issuer command owns issuance authority.
      result = await owner.issueCredential({ credential_id: c.credential_id, expected_revision: null, assertion: draft.assertion }, options);
    } else if (args.command === "issuer-revoke-b") {
      const existing = await client.getCredential(c.issuer_id, c.credential_id);
      ensure(existing && !existing.revoked, "ACTIVE_CREDENTIAL_REQUIRED");
      result = await owner.revokeCredential(c.credential_id, options);
    } else if (args.command === "provider-b-rotate") {
      const existing = await client.getService(account);
      ensure(existing && existing.version === 1 && existing.payout_account === c.providers.b.payout_account, "ORIGINAL_SERVICE_REQUIRED");
      result = await owner.setService({ expected_version: 1, payout_account: c.rotated_payout_account, invoice_key: existing.invoice_key, endpoint_hash: existing.endpoint_hash, active: true }, options);
    } else throw new Error("UNSUPPORTED_SETUP_STEP");
    const outcome = result as { kind: string; transaction: { tx_hash: string; sender_account_id: string } };
    if (outcome.kind === "final") {
      if (args.command !== "deploy-core") await capture.transaction(client, outcome.transaction);
      await captureState(capture, client, c, args.command);
      await capture.finish("passed", result, key);
    } else {
      if (outcome.kind === "failed") await capture.transaction(client, outcome.transaction);
      await capture.finish(outcome.kind === "uncertain" ? "uncertain" : "failed", result, key); process.exitCode = outcome.kind === "uncertain" ? 2 : 1;
    }
  } catch (error) { await capture.finish(capture.unresolvedBroadcast ? "uncertain" : "failed", { code: safeError(error), action: "Stop; inspect any transaction-before-send.json before another mutating invocation." }, key); process.exitCode = capture.unresolvedBroadcast ? 2 : 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runPreparation(process.argv.slice(2)).catch((error: unknown) => { console.error(safeError(error)); process.exitCode = 1; });
