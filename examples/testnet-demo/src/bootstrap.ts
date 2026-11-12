/** Offline bundle preparation and explicit, single-step USER-RUN testnet provisioning. */
import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, PublicKey, actions, baseDecode, baseEncode, type KeyPairString } from "near-api-js";
import { AccountDoesNotExistError } from "near-api-js/rpc-errors";
import { bounded } from "../../../packages/near-sdk/src/client.js";
import { ensure, finalTransaction, publicOnly } from "./capture.js";
import { exact, publicTemplate, renderPublicConfigs, sha256, validateConfig, fixedRpcMigrationIntent, LEGACY_TESTNET_RPC_URL, RPC_MIGRATION_FILE, TESTNET_RPC_URL, type DemoConfig } from "./config.js";

const RPC = TESTNET_RPC_URL, LEGACY_RPC = LEGACY_TESTNET_RPC_URL, HELPER = "https://helper.nearprotocol.com/account";
const MIGRATION_FILE = RPC_MIGRATION_FILE;
const NEAR = 10n ** 24n, MARGIN = NEAR / 10n;
export const bootstrapRoles = ["parent", "core", "owner", "issuer", "provider-a", "provider-b", "worker"] as const;
export type BootstrapRole = typeof bootstrapRoles[number];
const children = ["core", "owner", "issuer", "provider-a", "provider-b"] as const;
type ChildRole = typeof children[number];
const allocations: Record<ChildRole, bigint> = { core: 6n * NEAR, owner: 2n * NEAR, issuer: NEAR / 2n, "provider-a": NEAR / 2n, "provider-b": NEAR / 2n };
const steps = ["faucet", ...children.map((role) => `create-${role}`)] as const;
export interface BootstrapKey { schema_version: 1; role: BootstrapRole; account_id: string; public_key: string; private_key: string }
export interface BootstrapInvoice { schema_version: 1; role: "provider-a" | "provider-b"; public_key: string; seed_base64: string }
interface Manifest { schema_version: 1; network: "near:testnet"; rpc_url: string; helper_url: string; parent_id: string; expected_wasm_sha256: string; public_keys: Record<BootstrapRole, string>; invoice_keys: { a: string; b: string }; demo_sha256: string }
export interface BootstrapBundle { directory: string; manifest: Manifest; demo: DemoConfig; keys: Record<BootstrapRole, BootstrapKey>; invoices: { a: BootstrapInvoice; b: BootstrapInvoice }; rpc_migration_sha256: string | null }
export const bootstrapUsage = "Usage (offline): node dist/examples/testnet-demo/src/bootstrap.js --prepare --directory /absolute/NEW-private-directory\nUsage (offline RPC migration): node dist/examples/testnet-demo/src/bootstrap.js --migrate-rpc-fastnear|--resume-rpc-fastnear --directory /absolute/prepared-directory\nUsage (USER-RUN only): node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory /absolute/prepared-directory --step NAME\nSteps: " + steps.join(", ") + ". Prefix any step with observe- to inspect its immutable saved claim; never resend an uncertain operation. No deploy, registration, worker installation or model call is performed.";
export function bootstrapArguments(argv: readonly string[]): { directory: string; step: string } {
  const offline = argv.length === 3 && ["--prepare", "--migrate-rpc-fastnear", "--resume-rpc-fastnear"].includes(argv[0]!) && argv[1] === "--directory";
  const operate = argv.length === 5 && argv[0] === "--user-run" && argv[1] === "--directory" && argv[3] === "--step" && [...steps, ...steps.map((s) => `observe-${s}`)].includes(argv[4]!);
  ensure((offline || operate) && path.isAbsolute(argv[2] ?? "") && path.resolve(argv[2]!) === argv[2], "BOOTSTRAP_ARGUMENTS_REQUIRED");
  return { directory: argv[2]!, step: offline ? argv[0]!.slice(2) : argv[4]! };
}
export function inspectProductionWasm(bytes: Uint8Array): string {
  ensure(!Buffer.from(bytes).includes(Buffer.from("RUNTIME_TEST_CALLBACK_FAILURE")) && !Buffer.from(bytes).includes(Buffer.from("AGENTTRUST_RUNTIME_HELPER_ONLY")), "PRODUCTION_WASM_REQUIRED");
  const module = new WebAssembly.Module(Uint8Array.from(bytes)), imports = WebAssembly.Module.imports(module), exports = WebAssembly.Module.exports(module);
  for (const name of ["current_account_id", "predecessor_account_id", "signer_account_id", "signer_account_pk", "attached_deposit", "account_balance", "storage_usage", "read_register", "value_return", "storage_read", "storage_write", "ed25519_verify", "promise_batch_create", "promise_batch_action_transfer", "promise_results_count", "promise_result", "promise_batch_then", "promise_batch_action_function_call"]) ensure(imports.some((i) => i.module === "env" && i.name === name), "PRODUCTION_WASM_IMPORT_REQUIRED");
  for (const name of ["new", "deposit", "get_account", "set_policy", "set_profile", "register_session", "revoke_session", "get_config", "get_policy", "get_session", "set_service", "issue_credential", "revoke_credential", "get_service", "get_credential", "set_service_trust", "block_service", "block_payout", "execute_payment", "get_payment", "on_payment_result", "withdraw_available", "on_withdrawal_result", "get_withdrawal", "get_profile", "list_services", "list_recent_payments", "preview_payment"]) ensure(exports.some((e) => e.name === name && e.kind === "function"), "PRODUCTION_WASM_EXPORT_REQUIRED");
  return sha256(bytes);
}
const artifactHash = async (root: string) => inspectProductionWasm(await readFile(path.join(root, "target/wasm32-unknown-unknown/release/agenttrust_core.wasm")));
const accountId = (parent: string, role: BootstrapRole) => role === "parent" ? parent : `${role === "worker" ? "owner" : role.replace("provider", "service")}.${parent}`;
function invoicePublic(seed: string): string {
  const bytes = Buffer.from(seed, "base64");
  ensure(bytes.length === 32 && bytes.toString("base64") === seed, "INVALID_INVOICE_SEED");
  return createPublicKey(createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), bytes]), format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
}
async function privateDirectory(directory: string): Promise<void> {
  const stat = await lstat(directory);
  ensure(path.isAbsolute(directory) && await realpath(directory) === directory && stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o700 && stat.uid === process.getuid?.(), "PRIVATE_DIRECTORY_REQUIRED");
}
async function readPrivateBytes(file: string): Promise<Buffer> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    ensure(stat.isFile() && (stat.mode & 0o777) === 0o600 && stat.uid === process.getuid?.() && stat.size <= 128 * 1024, "PRIVATE_FILE_REQUIRED");
    return await handle.readFile();
  } finally { await handle.close(); }
}
const readPrivate = async (file: string): Promise<unknown> => JSON.parse((await readPrivateBytes(file)).toString("utf8"));
async function exclusive(file: string, value: unknown): Promise<void> {
  const handle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(value, (_k, v: unknown) => typeof v === "bigint" ? v.toString() : v, 2) + "\n"); await handle.sync(); } finally { await handle.close(); }
  const directory = await open(path.dirname(file), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await directory.sync(); } finally { await directory.close(); }
}
type PublicRpcFile = { name: string; bytes: Buffer; value: Record<string, unknown> };
/** Reads and validates only: no provider, signer, network request or transaction is constructed. */
export async function loadBootstrapBundle(directory: string, root = process.cwd()): Promise<BootstrapBundle> {
  return (await readBootstrapBundle(directory, root)).bundle;
}
async function readBootstrapBundle(directory: string, root: string, transition = false) {
  await privateDirectory(directory);
  for (const child of ["secrets", "operations", "evidence"]) await privateDirectory(path.join(directory, child));
  const manifestBytes = await readPrivateBytes(path.join(directory, "bootstrap.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as Manifest;
  ensure(exact(manifest, ["schema_version", "network", "rpc_url", "helper_url", "parent_id", "expected_wasm_sha256", "public_keys", "invoice_keys", "demo_sha256"]) && manifest.schema_version === 1 && manifest.network === "near:testnet" && [LEGACY_RPC, RPC].includes(manifest.rpc_url) && manifest.helper_url === HELPER && /^agenttrust-[a-f0-9]{24}\.testnet$/.test(manifest.parent_id) && exact(manifest.public_keys, [...bootstrapRoles]) && exact(manifest.invoice_keys, ["a", "b"]), "BOOTSTRAP_MANIFEST_MISMATCH");
  let migrationBytes: Buffer | null = null;
  try { migrationBytes = await readPrivateBytes(path.join(directory, MIGRATION_FILE)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (migrationBytes) ensure(manifest.rpc_url === LEGACY_RPC && isDeepStrictEqual(JSON.parse(migrationBytes.toString("utf8")), fixedRpcMigrationIntent(manifest, manifestBytes)), "RPC_MIGRATION_INTENT_MISMATCH");
  const allowedRpc = migrationBytes ? transition ? [LEGACY_RPC, RPC] : [RPC] : [manifest.rpc_url];
  const keys = {} as BootstrapBundle["keys"], invoices = {} as BootstrapBundle["invoices"];
  for (const role of bootstrapRoles) {
    const key = await readPrivate(path.join(directory, "secrets", `${role}.json`)) as BootstrapKey;
    ensure(exact(key, ["schema_version", "role", "account_id", "public_key", "private_key"]) && key.schema_version === 1 && key.role === role && key.account_id === accountId(manifest.parent_id, role) && typeof key.private_key === "string" && key.private_key.startsWith("ed25519:") && KeyPair.fromString(key.private_key as KeyPairString).getPublicKey().toString() === key.public_key && manifest.public_keys[role] === key.public_key, "BOOTSTRAP_KEY_MISMATCH");
    const secretBytes = baseDecode(key.private_key.slice("ed25519:".length));
    ensure(secretBytes.length === 64 && Buffer.from(secretBytes.subarray(32)).equals(Buffer.from(PublicKey.from(key.public_key).data)) && baseEncode(secretBytes) === key.private_key.slice("ed25519:".length) && invoicePublic(Buffer.from(secretBytes.subarray(0, 32)).toString("base64")) === Buffer.from(PublicKey.from(key.public_key).data).toString("base64"), "BOOTSTRAP_SECRET_SEED_MISMATCH");
    keys[role] = key;
  }
  for (const label of ["a", "b"] as const) {
    const invoice = await readPrivate(path.join(directory, "secrets", `provider-${label}-invoice.json`)) as BootstrapInvoice;
    ensure(exact(invoice, ["schema_version", "role", "public_key", "seed_base64"]) && invoice.schema_version === 1 && invoice.role === `provider-${label}` && invoicePublic(invoice.seed_base64) === invoice.public_key && invoice.public_key === manifest.invoice_keys[label], "BOOTSTRAP_INVOICE_MISMATCH");
    invoices[label] = invoice;
  }
  ensure(new Set([...Object.values(keys).map((k) => Buffer.from(PublicKey.from(k.public_key).data).toString("base64")), ...Object.values(invoices).map((i) => i.public_key)]).size === 9, "INDEPENDENT_KEYS_REQUIRED");
  const demoBytes = await readPrivateBytes(path.join(directory, "demo.json")), demo = validateConfig(JSON.parse(demoBytes.toString("utf8")));
  const publicFiles: PublicRpcFile[] = [{ name: "demo.json", bytes: demoBytes, value: demo as unknown as Record<string, unknown> }];
  ensure(allowedRpc.includes(demo.rpc_url) && sha256(JSON.stringify({ ...demo, rpc_url: manifest.rpc_url })) === manifest.demo_sha256 && demo.expected_wasm_sha256 === manifest.expected_wasm_sha256 && await artifactHash(root) === manifest.expected_wasm_sha256, "BOOTSTRAP_CONFIG_OR_WASM_MISMATCH");
  ensure(demo.core_account === keys.core.account_id && demo.owner_id === keys.owner.account_id && demo.issuer_id === keys.issuer.account_id && demo.worker_public_key === keys.worker.public_key && demo.rotated_payout_account === manifest.parent_id && demo.profile_id === "invoice-audit" && demo.attempts_directory === path.join(directory, "attempts"), "BOOTSTRAP_ROLE_BINDING_MISMATCH");
  ensure(new Set([demo.session_id, demo.credential_id, ...Object.values(demo.payment_ids)]).size === 6, "DISTINCT_DEMO_IDS_REQUIRED");
  const rendered = renderPublicConfigs(demo);
  for (const label of ["a", "b"] as const) {
    const p = demo.providers[label], expected = rendered[`provider_${label}`];
    ensure(p.service_id === keys[`provider-${label}`].account_id && p.payout_account === p.service_id && p.invoice_key === invoices[label].public_key && p.port === (label === "a" ? 4041 : 4042) && p.origin === `https://localhost:${p.port}` && p.amount_yocto === "2000000000000000000000", "BOOTSTRAP_PROVIDER_BINDING_MISMATCH");
    const bytes = await readPrivateBytes(path.join(directory, `provider-${label}.json`)), actual: unknown = JSON.parse(bytes.toString("utf8"));
    ensure(exact(actual, Object.keys(expected)) && exact(actual.tls, ["cert_file", "key_file"]) && Object.values(actual.tls).every((v) => typeof v === "string" && path.isAbsolute(v)) && allowedRpc.includes(actual.rpc_url as string) && isDeepStrictEqual({ ...actual, rpc_url: demo.rpc_url, tls: expected.tls }, expected), "BOOTSTRAP_PROVIDER_CONFIG_MISMATCH");
    publicFiles.push({ name: `provider-${label}.json`, bytes, value: actual });
  }
  const mcpBytes = await readPrivateBytes(path.join(directory, "mcp.json")), mcp: unknown = JSON.parse(mcpBytes.toString("utf8"));
  ensure(exact(mcp, Object.keys(rendered.mcp)) && allowedRpc.includes(mcp.rpc_url as string) && isDeepStrictEqual({ ...mcp, rpc_url: demo.rpc_url }, rendered.mcp), "BOOTSTRAP_MCP_MISMATCH");
  publicFiles.push({ name: "mcp.json", bytes: mcpBytes, value: mcp });
  const bundle: BootstrapBundle = { directory, manifest, demo, keys, invoices, rpc_migration_sha256: migrationBytes ? sha256(migrationBytes) : null };
  return { bundle, manifestBytes, publicFiles };
}
async function beforePaymentWork(bundle: BootstrapBundle): Promise<void> {
  for (const file of [bundle.demo.attempts_directory, ...["buyer-jobs", "buyer-scripted.json", "buyer-near-ai.json"].map((name) => path.join(bundle.directory, name))]) {
    try { await lstat(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    throw new Error("RPC_MIGRATION_REQUIRES_NO_T18_OR_BUYER_WORK");
  }
}
/** Fixed offline repair only. Original manifest, keys, claims and captures are never rewritten. */
export async function migrateBootstrapRpc(directory: string, resume = false, root = process.cwd()) {
  const original = await readBootstrapBundle(directory, root, resume);
  ensure(original.bundle.manifest.rpc_url === LEGACY_RPC, "LEGACY_BOOTSTRAP_REQUIRED");
  ensure(resume ? original.bundle.rpc_migration_sha256 !== null : original.bundle.rpc_migration_sha256 === null, resume ? "SAVED_RPC_MIGRATION_REQUIRED" : "RPC_MIGRATION_ALREADY_CLAIMED_USE_RESUME");
  await beforePaymentWork(original.bundle);
  if (!resume) {
    const temporary = path.join(directory, `.rpc-migration-intent-${randomBytes(12).toString("hex")}.tmp`);
    try {
      await exclusive(temporary, fixedRpcMigrationIntent(original.bundle.manifest, original.manifestBytes));
      await link(temporary, path.join(directory, MIGRATION_FILE)); // Atomic publication, never overwrite an existing intent.
    } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  }
  const intentDirectory = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await intentDirectory.sync(); } finally { await intentDirectory.close(); }
  // The immutable intent is durable before any public RPC field can change.
  const current = await readBootstrapBundle(directory, root, true);
  await beforePaymentWork(current.bundle);
  for (const file of current.publicFiles) {
    if (file.value.rpc_url === RPC) continue;
    ensure((await readPrivateBytes(path.join(directory, file.name))).equals(file.bytes), "RPC_MIGRATION_FILE_CHANGED");
    const temporary = path.join(directory, `.rpc-migration-${file.name}-${randomBytes(12).toString("hex")}.tmp`);
    try {
      await exclusive(temporary, { ...file.value, rpc_url: RPC });
      ensure((await readPrivateBytes(path.join(directory, file.name))).equals(file.bytes), "RPC_MIGRATION_FILE_CHANGED");
      await rename(temporary, path.join(directory, file.name));
      const handle = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { await handle.sync(); } finally { await handle.close(); }
    } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  }
  const migrated = await loadBootstrapBundle(directory, root);
  return { status: "rpc_migrated", directory, rpc_url: migrated.demo.rpc_url, rpc_migration_sha256: migrated.rpc_migration_sha256, network_contacted: false };
}
export async function prepareBootstrap(directory: string, root = process.cwd()): Promise<BootstrapBundle> {
  ensure(path.isAbsolute(directory) && path.resolve(directory) === directory && await realpath(path.dirname(directory)) === path.dirname(directory), "CANONICAL_NEW_DIRECTORY_REQUIRED");
  const wasm = await artifactHash(root);
  await mkdir(directory, { mode: 0o700 }); // Exclusive even after interrupted preparation: never replace identities.
  await privateDirectory(directory);
  for (const child of ["secrets", "operations", "evidence"]) await mkdir(path.join(directory, child), { mode: 0o700 });
  const parent = `agenttrust-${randomBytes(12).toString("hex")}.testnet`, keys = {} as BootstrapBundle["keys"], invoices = {} as BootstrapBundle["invoices"];
  for (const role of bootstrapRoles) {
    const pair = KeyPair.fromRandom("ed25519");
    keys[role] = { schema_version: 1, role, account_id: accountId(parent, role), public_key: pair.getPublicKey().toString(), private_key: pair.toString() };
    await exclusive(path.join(directory, "secrets", `${role}.json`), keys[role]);
  }
  for (const label of ["a", "b"] as const) {
    const seed = randomBytes(32).toString("base64");
    invoices[label] = { schema_version: 1, role: `provider-${label}`, public_key: invoicePublic(seed), seed_base64: seed };
    await exclusive(path.join(directory, "secrets", `provider-${label}-invoice.json`), invoices[label]);
  }
  const template = publicTemplate() as DemoConfig;
  const demo = validateConfig({ ...template, core_account: keys.core.account_id, expected_wasm_sha256: wasm, owner_id: keys.owner.account_id, issuer_id: keys.issuer.account_id, worker_public_key: keys.worker.public_key, attempts_directory: path.join(directory, "attempts"), rotated_payout_account: parent, providers: Object.fromEntries((["a", "b"] as const).map((label) => [label, { ...template.providers[label], service_id: keys[`provider-${label}`].account_id, payout_account: keys[`provider-${label}`].account_id, invoice_key: invoices[label].public_key }])) });
  const manifest: Manifest = { schema_version: 1, network: "near:testnet", rpc_url: RPC, helper_url: HELPER, parent_id: parent, expected_wasm_sha256: wasm, public_keys: Object.fromEntries(bootstrapRoles.map((role) => [role, keys[role].public_key])) as Manifest["public_keys"], invoice_keys: { a: invoices.a.public_key, b: invoices.b.public_key }, demo_sha256: sha256(JSON.stringify(demo)) };
  const configs = renderPublicConfigs(demo);
  for (const [name, value] of Object.entries({ "demo.json": demo, "bootstrap.json": manifest, "provider-a.json": configs.provider_a, "provider-b.json": configs.provider_b, "mcp.json": configs.mcp })) await exclusive(path.join(directory, name), value);
  const bundle = await loadBootstrapBundle(directory, root);
  await evidence(bundle, "prepare", "prepared", { accounts_created: false, network_contacted: false });
  return bundle;
}
interface Claim { schema_version: 1; bundle_sha256: string; step: string; parent_id: string; parent_public_key: string; receiver_id: string; receiver_public_key: string; amount_yocto: string; helper_url: string | null; request: { newAccountId: string; newAccountPublicKey: string } | null; transaction: { tx_hash: string; sender_account_id: string } | null }
function intent(bundle: BootstrapBundle, step: string): Omit<Claim, "transaction"> {
  const role = step.slice("create-".length) as ChildRole, faucet = step === "faucet";
  return { schema_version: 1, bundle_sha256: sha256(JSON.stringify(bundle.manifest)), step, parent_id: bundle.manifest.parent_id, parent_public_key: bundle.keys.parent.public_key, receiver_id: faucet ? bundle.manifest.parent_id : bundle.keys[role].account_id, receiver_public_key: faucet ? bundle.keys.parent.public_key : bundle.keys[role].public_key, amount_yocto: faucet ? "0" : allocations[role].toString(), helper_url: faucet ? HELPER : null, request: faucet ? { newAccountId: bundle.manifest.parent_id, newAccountPublicKey: bundle.keys.parent.public_key } : null };
}
async function claimFor(bundle: BootstrapBundle, step: string): Promise<Claim | null> {
  let claim: unknown;
  try { claim = await readPrivate(path.join(bundle.directory, "operations", `${step}.json`)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const expected = intent(bundle, step);
  ensure(exact(claim, [...Object.keys(expected), "transaction"]) && isDeepStrictEqual({ ...claim, transaction: undefined }, { ...expected, transaction: undefined }), "BOOTSTRAP_CLAIM_MISMATCH");
  if (step === "faucet") ensure(claim.transaction === null, "BOOTSTRAP_CLAIM_MISMATCH");
  else ensure(exact(claim.transaction, ["tx_hash", "sender_account_id"]) && claim.transaction.sender_account_id === bundle.manifest.parent_id && typeof claim.transaction.tx_hash === "string" && baseDecode(claim.transaction.tx_hash).length === 32, "BOOTSTRAP_TRANSACTION_MISMATCH");
  return claim as unknown as Claim;
}
async function evidence(bundle: BootstrapBundle, step: string, status: "prepared" | "created" | "observed" | "uncertain", result: unknown) {
  const record = { schema_version: 1, kind: "agenttrust_testnet_bootstrap", captured_at: new Date().toISOString(), bundle_sha256: sha256(JSON.stringify(bundle.manifest)), network: "near:testnet", rpc_url: bundle.demo.rpc_url, rpc_migration_sha256: bundle.rpc_migration_sha256, step, status, result, native_runtime_gate: "not_evaluated", model_gate: "not_evaluated" };
  publicOnly(record);
  const file = path.join(bundle.directory, "evidence", `${step}-${randomBytes(12).toString("hex")}.json`);
  await exclusive(file, record);
  return { status, evidence_file: file };
}
async function absent(provider: JsonRpcProvider, account: string): Promise<void> {
  try { await bounded(provider.viewAccount({ accountId: account, blockQuery: { finality: "final" } })); }
  catch (error) { if (error instanceof AccountDoesNotExistError && error.accountId === account) return; throw error; }
  throw new Error("ACCOUNT_ALREADY_EXISTS_USE_OBSERVATION");
}
async function accountAndKey(provider: JsonRpcProvider, account: string, key: string) {
  const state = await bounded(provider.viewAccount({ accountId: account, blockQuery: { finality: "final" } }));
  const access = await bounded(provider.viewAccessKey({ accountId: account, publicKey: PublicKey.from(key), finalityQuery: { finality: "final" } }));
  ensure(access.permission === "FullAccess", "EXPECTED_FULL_ACCESS_KEY_REQUIRED");
  return { account: state, access_key: access };
}
function expectedActions(claim: Claim) { return ["CreateAccount", { Transfer: { deposit: claim.amount_yocto } }, { AddKey: { public_key: claim.receiver_public_key, access_key: { nonce: 0, permission: "FullAccess" } } }]; }
async function observeCreation(provider: JsonRpcProvider, claim: Claim) {
  ensure(claim.transaction, "SAVED_TRANSACTION_REQUIRED");
  const raw = await bounded(provider.sendJsonRpc("EXPERIMENTAL_tx_status", { ...claim.transaction, wait_until: "FINAL" }));
  finalTransaction(raw, claim.transaction);
  const tx = raw.transaction;
  ensure(tx.signer_id === claim.parent_id && tx.public_key === claim.parent_public_key && tx.receiver_id === claim.receiver_id && isDeepStrictEqual(tx.actions, expectedActions(claim)), "CREATION_TRANSACTION_BINDING_MISMATCH");
  ensure(typeof raw.status === "object" && raw.status !== null && "SuccessValue" in raw.status && !raw.receipts_outcome.some((receipt) => typeof receipt.outcome.status === "object" && "Failure" in receipt.outcome.status), "CREATION_TRANSACTION_NOT_SUCCESSFUL");
  return { final_transaction: raw, resulting_state: await accountAndKey(provider, claim.receiver_id, claim.receiver_public_key) };
}
/** Every invocation either observes one saved claim or dispatches exactly one new fixed operation. */
export async function runBootstrapStep(directory: string, requestedStep: string, root = process.cwd()) {
  const args = bootstrapArguments(["--user-run", "--directory", directory, "--step", requestedStep]);
  const bundle = await loadBootstrapBundle(args.directory, root), observation = args.step.startsWith("observe-"), step = observation ? args.step.slice(8) : args.step;
  const previous = await claimFor(bundle, step);
  ensure(observation ? previous !== null : previous === null, observation ? "SAVED_CLAIM_REQUIRED" : "SAVED_CLAIM_USE_OBSERVE");
  if (!observation) {
    const now = BigInt(Date.now()) * 1_000_000n;
    ensure(BigInt(bundle.demo.session_expires_at_ns) > now && BigInt(bundle.demo.credential_expires_at_ns) > now, "DEMO_EXPIRED_NO_NEW_PROVISIONING");
  }
  const provider = new JsonRpcProvider({ url: bundle.demo.rpc_url }, { retries: 1 });
  ensure((await bounded(provider.sendJsonRpc("status", []))).chain_id === "testnet", "TESTNET_REQUIRED");
  if (observation) {
    try {
      const result = step === "faucet" ? { resulting_state: await accountAndKey(provider, bundle.manifest.parent_id, bundle.keys.parent.public_key), provenance: "Observed account/key after saved faucet claim; helper completion and original grant amount are not proven." } : await observeCreation(provider, previous!);
      return await evidence(bundle, args.step, "observed", result);
    } catch { return evidence(bundle, args.step, "uncertain", { code: "SAVED_OPERATION_UNRESOLVED", resend_allowed: false }); }
  }
  const claim: Claim = { ...intent(bundle, step), transaction: null }, claimFile = path.join(directory, "operations", `${step}.json`);
  if (step === "faucet") {
    await absent(provider, bundle.manifest.parent_id);
    await exclusive(claimFile, claim); // Must be durable before the one POST, even if dispatch never happens.
    try {
      const response = await fetch(HELPER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(claim.request), redirect: "error", signal: AbortSignal.timeout(30_000) });
      await response.body?.cancel(); // No untrusted helper body is logged or treated as chain evidence.
      ensure(response.ok, "FAUCET_RESPONSE_UNCONFIRMED");
      return await evidence(bundle, step, "created", { resulting_state: await accountAndKey(provider, claim.parent_id, claim.parent_public_key), helper_http_status: response.status });
    } catch { return evidence(bundle, step, "uncertain", { code: "FAUCET_RESULT_UNRESOLVED", resend_allowed: false }); }
  }
  ensure(await claimFor(bundle, "faucet"), "SAVED_FAUCET_CLAIM_REQUIRED");
  const role = step.slice(7) as ChildRole, index = children.indexOf(role);
  for (const priorRole of children.slice(0, index)) {
    const prior = await claimFor(bundle, `create-${priorRole}`);
    ensure(prior, "PREVIOUS_CHILD_CREATION_REQUIRED");
    await observeCreation(provider, prior);
  }
  // Check every remaining fixed name before spending any more funds; never adopt an unrelated account.
  for (const future of children.slice(index)) await absent(provider, bundle.keys[future].account_id);
  const parent = await accountAndKey(provider, claim.parent_id, claim.parent_public_key);
  ensure(parent.account.code_hash === baseEncode(Buffer.alloc(32)) && parent.account.locked === 0n && parent.account.amount >= 0n && Number.isSafeInteger(parent.account.storage_usage) && parent.account.storage_usage >= 0, "FRESH_PARENT_REQUIRED");
  if (index === 0) ensure(parent.account.amount >= 10n * NEAR, "INITIAL_PARENT_GROSS_TEN_NEAR_REQUIRED");
  const protocol = await bounded(provider.experimental_protocolConfig({ finality: "final" }));
  const cost = protocol.runtime_config?.storage_amount_per_byte;
  ensure(typeof cost === "string" && /^[0-9]+$/.test(cost), "STORAGE_PRICE_REQUIRED");
  const remaining = children.slice(index).reduce((sum, r) => sum + allocations[r], 0n);
  ensure(parent.account.amount - BigInt(parent.account.storage_usage) * BigInt(cost) >= remaining + MARGIN, "PARENT_AVAILABLE_BUDGET_REQUIRED");
  const signer = KeyPairSigner.fromSecretKey(bundle.keys.parent.private_key as KeyPairString);
  const account = new Account(claim.parent_id, provider, signer);
  const tx = await bounded(account.createTransaction({ receiverId: claim.receiver_id, publicKey: PublicKey.from(claim.parent_public_key), actions: [actions.createAccount(), actions.transfer(allocations[role]), actions.addFullAccessKey(PublicKey.from(claim.receiver_public_key))] }));
  const signed = await signer.signTransaction(tx);
  claim.transaction = { tx_hash: baseEncode(signed.txHash), sender_account_id: claim.parent_id };
  await exclusive(claimFile, claim);
  try {
    await bounded(provider.sendTransactionUntil(signed.signedTransaction, "FINAL"));
    return await evidence(bundle, step, "created", await observeCreation(provider, claim));
  } catch { return evidence(bundle, step, "uncertain", { code: "CHILD_RESULT_UNRESOLVED", transaction: claim.transaction, resend_allowed: false }); }
}
export async function runBootstrap(argv: readonly string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") { console.log(bootstrapUsage); return; }
  const args = bootstrapArguments(argv);
  if (args.step === "prepare") { await prepareBootstrap(args.directory); console.log(JSON.stringify({ status: "prepared", directory: args.directory, accounts_created: false, native_runtime_gate: "not_evaluated", model_gate: "not_evaluated" })); return; }
  if (args.step === "migrate-rpc-fastnear" || args.step === "resume-rpc-fastnear") { console.log(JSON.stringify(await migrateBootstrapRpc(args.directory, args.step === "resume-rpc-fastnear"))); return; }
  const result = await runBootstrapStep(args.directory, args.step);
  console.log(JSON.stringify(result));
  if (result.status === "uncertain") process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runBootstrap(process.argv.slice(2)).catch(() => { console.error("BOOTSTRAP_REFUSED_OR_FAILED: inspect the private bundle and saved claims; never resend uncertain work."); process.exitCode = 1; });
