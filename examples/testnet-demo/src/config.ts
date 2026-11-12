import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { open, readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { dirname, isAbsolute, join } from "node:path";
import { PublicKey } from "near-api-js";
import { validateAccountId, validateHash32, validateProfileId, validateU64, validateU128 } from "../../../packages/near-sdk/src/codec.js";
import { canonicalOrigin, endpointHash } from "../../../packages/near-sdk/src/directory.js";
import { loadConformanceSuite } from "../../invoice-audit/src/conformance.js";

export interface DemoProvider { service_id: string; payout_account: string; invoice_key: string; origin: string; amount_yocto: string; port: number }
export interface DemoConfig {
  schema_version: 1; network: "near:testnet"; rpc_url: string; core_account: string; expected_wasm_sha256: string;
  owner_id: string; issuer_id: string; worker_public_key: string; session_id: string; profile_id: string;
  session_expires_at_ns: string; credential_id: string; credential_expires_at_ns: string;
  attempts_directory: string; rotated_payout_account: string; providers: { a: DemoProvider; b: DemoProvider };
  payment_ids: { missing: string; paid: string; revoked: string; identity: string };
}
export const TESTNET_RPC_URL = "https://test.rpc.fastnear.com";
export const LEGACY_TESTNET_RPC_URL = "https://rpc.testnet.near.org";
export const RPC_MIGRATION_FILE = "rpc-migration-fastnear.json";
export const limits = Object.freeze({ owner_deposit: "1000000000000000000000000", owner_storage: "250000000000000000000000", registry_deposit: "100000000000000000000000", daily_cap: "50000000000000000000000", purchase_cap: "10000000000000000000000", key_allowance: "500000000000000000000000", operating_reserve: "50000000000000000000000", rate: 5 });
export const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
export const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");
export function validateConfig(value: unknown): DemoConfig {
  if (!exact(value, ["schema_version", "network", "rpc_url", "core_account", "expected_wasm_sha256", "owner_id", "issuer_id", "worker_public_key", "session_id", "profile_id", "session_expires_at_ns", "credential_id", "credential_expires_at_ns", "attempts_directory", "rotated_payout_account", "providers", "payment_ids"]) || value.schema_version !== 1 || value.network !== "near:testnet") throw new Error("INVALID_DEMO_CONFIG");
  const c = value as unknown as DemoConfig;
  for (const id of [c.core_account, c.owner_id, c.issuer_id, c.rotated_payout_account]) validateAccountId(id);
  const rpc = new URL(c.rpc_url);
  if (rpc.protocol !== "https:" || rpc.username || rpc.password || rpc.hash || rpc.search) throw new Error("INVALID_RPC_URL");
  if (!/^[a-f0-9]{64}$/.test(c.expected_wasm_sha256) || /^0+$/.test(c.expected_wasm_sha256)) throw new Error("EXPECTED_WASM_HASH_REQUIRED");
  if (!isAbsolute(c.attempts_directory)) throw new Error("ABSOLUTE_ATTEMPTS_DIRECTORY_REQUIRED");
  validateHash32(c.session_id); validateHash32(c.credential_id); validateProfileId(c.profile_id);
  validateU64(c.session_expires_at_ns); validateU64(c.credential_expires_at_ns);
  if (!c.worker_public_key.startsWith("ed25519:")) throw new Error("ED25519_WORKER_REQUIRED");
  PublicKey.from(c.worker_public_key);
  if (!exact(c.providers, ["a", "b"])) throw new Error("TWO_PROVIDERS_REQUIRED");
  for (const p of Object.values(c.providers)) {
    if (!exact(p, ["service_id", "payout_account", "invoice_key", "origin", "amount_yocto", "port"])) throw new Error("INVALID_PROVIDER");
    validateAccountId(p.service_id); validateAccountId(p.payout_account); validateHash32(p.invoice_key); canonicalOrigin(p.origin); validateU128(p.amount_yocto);
    if (BigInt(p.amount_yocto) === 0n || BigInt(p.amount_yocto) > BigInt(limits.purchase_cap) || !Number.isInteger(p.port) || p.port < 1024 || p.port > 65535) throw new Error("INVALID_PROVIDER_LIMIT");
  }
  if (new Set([c.core_account, c.owner_id, c.issuer_id, c.providers.a.service_id, c.providers.b.service_id]).size !== 5 || c.providers.a.origin === c.providers.b.origin || c.rotated_payout_account === c.providers.b.payout_account) throw new Error("DISTINCT_DEMO_ROLES_REQUIRED");
  if (Object.values(c.providers).some((p) => p.payout_account === c.owner_id || p.payout_account === c.core_account)) throw new Error("PAYOUT_CANNOT_BE_GAS_PAYER_OR_VAULT");
  if (!exact(c.payment_ids, ["missing", "paid", "revoked", "identity"])) throw new Error("INVALID_PAYMENT_IDS");
  Object.values(c.payment_ids).forEach(validateHash32);
  if (new Set(Object.values(c.payment_ids)).size !== 4) throw new Error("DISTINCT_PAYMENT_IDS_REQUIRED");
  return structuredClone(c);
}
export async function readConfig(file: string): Promise<DemoConfig> {
  if (!isAbsolute(file)) throw new Error("ABSOLUTE_CONFIG_PATH_REQUIRED");
  const bytes = await readFile(file);
  if (bytes.length > 32 * 1024) throw new Error("CONFIG_TOO_LARGE");
  const config = validateConfig(JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)));
  await requireCompletedRpcMigration(file, config);
  return config;
}
export function fixedRpcMigrationIntent(manifest: { rpc_url: string; demo_sha256: string }, manifestBytes: Uint8Array) {
  return { schema_version: 1, from_rpc_url: LEGACY_TESTNET_RPC_URL, to_rpc_url: TESTNET_RPC_URL, bootstrap_sha256: sha256(manifestBytes), bundle_sha256: sha256(JSON.stringify(manifest)), original_demo_sha256: manifest.demo_sha256 };
}
/** Public-only guard for direct T18 commands, including keyless recovery; never reads secrets. */
async function requireCompletedRpcMigration(file: string, config: DemoConfig): Promise<void> {
  const directory = dirname(file);
  const read = async (name: string) => {
    const handle = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW);
    try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > 128 * 1024) throw new Error("INVALID_RPC_MIGRATION_FILE"); return await handle.readFile(); }
    finally { await handle.close(); }
  };
  let marker: unknown;
  try { marker = JSON.parse((await read(RPC_MIGRATION_FILE)).toString("utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  const manifestBytes = await read("bootstrap.json"), manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest?.schema_version !== 1 || manifest.network !== "near:testnet" || manifest.rpc_url !== LEGACY_TESTNET_RPC_URL || !isDeepStrictEqual(marker, fixedRpcMigrationIntent(manifest, manifestBytes)) || config.rpc_url !== TESTNET_RPC_URL || sha256(JSON.stringify({ ...config, rpc_url: LEGACY_TESTNET_RPC_URL })) !== manifest.demo_sha256) throw new Error("RPC_MIGRATION_BINDING_MISMATCH");
  for (const name of ["demo.json", "provider-a.json", "provider-b.json", "mcp.json"]) {
    if (JSON.parse((await read(name)).toString("utf8"))?.rpc_url !== TESTNET_RPC_URL) throw new Error("RPC_MIGRATION_INCOMPLETE");
  }
}
export function publicTemplate(now = Date.now()): unknown {
  const id = () => randomBytes(32).toString("base64");
  const provider = (label: string, port: number) => ({ service_id: `REPLACE_${label}_ACCOUNT`, payout_account: `REPLACE_${label}_PAYOUT`, invoice_key: "REPLACE_RAW_ED25519_PUBLIC_KEY_BASE64", origin: `https://localhost:${port}`, amount_yocto: "2000000000000000000000", port });
  return { schema_version: 1, network: "near:testnet", rpc_url: TESTNET_RPC_URL, core_account: "REPLACE_CORE_ACCOUNT", expected_wasm_sha256: "REPLACE_REVIEWED_PRODUCTION_WASM_SHA256", owner_id: "REPLACE_OWNER_ACCOUNT", issuer_id: "REPLACE_ISSUER_ACCOUNT", worker_public_key: "REPLACE_ed25519_WORKER_PUBLIC_KEY", session_id: id(), profile_id: "invoice-audit", session_expires_at_ns: ((BigInt(now) + 86_400_000n) * 1_000_000n).toString(), credential_id: id(), credential_expires_at_ns: ((BigInt(now) + 86_400_000n) * 1_000_000n).toString(), attempts_directory: "/REPLACE/absolute/private/attempts", rotated_payout_account: "REPLACE_DIFFERENT_EXISTING_PAYOUT", providers: { a: provider("PROVIDER_A", 4041), b: provider("PROVIDER_B", 4042) }, payment_ids: { missing: id(), paid: id(), revoked: id(), identity: id() } };
}
export function service(c: DemoConfig, label: "a" | "b") {
  const p = c.providers[label];
  return { service_id: p.service_id, version: 1, payout_account: p.payout_account, invoice_key: p.invoice_key, endpoint_hash: endpointHash(p.origin), active: true };
}
export const catalog = (c: DemoConfig) => Object.values(c.providers).map((p) => ({ service_id: p.service_id, service_version: 1, origin: p.origin }));
export const requirement = (c: DemoConfig) => ({ capability_namespace: "invoice.audit" as const, capability_version: 1 as const, conformance_suite_version: 1, conformance_suite_hash: loadConformanceSuite().hash, accepted_issuers: [c.issuer_id] });
export const credential = (c: DemoConfig) => ({ issuer_id: c.issuer_id, credential_id: c.credential_id, revision: 1 });
/** Public files only. The operator supplies local TLS paths and dedicated signing secrets separately. */
export function renderPublicConfigs(c: DemoConfig) {
  const provider = (label: "a" | "b") => ({ schema_version: 1, network: c.network, core_account: c.core_account, rpc_url: c.rpc_url, offer: { service: service(c, label), origin: c.providers[label].origin, amount_yocto: c.providers[label].amount_yocto }, port: c.providers[label].port, tls: { cert_file: "/REPLACE/absolute/localhost-cert.pem", key_file: "/REPLACE/absolute/localhost-key.pem" } });
  return { provider_a: provider("a"), provider_b: provider("b"), mcp: { schema_version: 1, network: c.network, core_account: c.core_account, rpc_url: c.rpc_url, owner_id: c.owner_id, session_id: c.session_id, attempts_directory: c.attempts_directory, catalog: catalog(c), credentials: [{ service_id: c.providers.b.service_id, service_version: 1, credential: credential(c) }], wait_timeout_ms: 60_000 } };
}
export function argumentsFor(argv: readonly string[], names: readonly string[]): { command: string; config: string; output: string } {
  if (argv.length !== 7 || argv[0] !== "--user-run" || argv[1] !== "--config" || argv[3] !== "--output" || argv[5] !== "--step" || !names.includes(argv[6]!)) throw new Error("EXPLICIT_USER_RUN_ARGUMENTS_REQUIRED");
  if (!isAbsolute(argv[2]!) || !argv[4]) throw new Error("INVALID_RUN_PATH");
  return { command: argv[6]!, config: argv[2]!, output: argv[4]! };
}
