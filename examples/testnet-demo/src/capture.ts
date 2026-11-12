import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { baseEncode } from "near-api-js";
import type { AgentTrustClient } from "../../../packages/near-sdk/src/client.js";
import type { TransactionLocator } from "../../../packages/near-sdk/src/views.js";
import { sha256, type DemoConfig } from "./config.js";

export const ensure: (condition: unknown, code: string) => asserts condition = (condition, code) => { if (!condition) throw new Error(code); };
export function publicOnly(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(publicOnly); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    ensure(!/(private.?key|secret.?key|seed|mnemonic|password|authorization|auth.?token|csv_utf8)/i.test(key), "SECRET_OR_CSV_FIELD_REJECTED");
    publicOnly(child);
  }
}
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
export function finalTransaction(raw: unknown, transaction: TransactionLocator): void {
  ensure(object(raw) && raw.final_execution_status === "FINAL" && object(raw.transaction) && raw.transaction.hash === transaction.tx_hash && raw.transaction.signer_id === transaction.sender_account_id && Array.isArray(raw.receipts_outcome), "FINAL_TRANSACTION_REQUIRED");
  ensure(object(raw.transaction_outcome) && raw.transaction_outcome.id === transaction.tx_hash && object(raw.status) && ("SuccessValue" in raw.status || "Failure" in raw.status), "FINAL_TRANSACTION_STATUS_REQUIRED");
  const ids = new Set([transaction.tx_hash]);
  for (const receipt of raw.receipts_outcome) {
    ensure(object(receipt) && typeof receipt.id === "string" && !ids.has(receipt.id) && object(receipt.outcome) && typeof receipt.outcome.executor_id === "string" && object(receipt.outcome.status), "FINAL_RECEIPT_REQUIRED");
    const status = receipt.outcome.status;
    ensure("SuccessValue" in status || "SuccessReceiptId" in status || "Failure" in status, "FINAL_RECEIPT_REQUIRED");
    ids.add(receipt.id);
  }
}
export class Capture {
  private readonly artifacts: { path: string; sha256: string; kind: string }[] = [];
  private readonly capturedAt = new Date().toISOString();
  private constructor(readonly directory: string, readonly config: DemoConfig, readonly step: string, readonly command: string) {}
  static async start(output: string, config: DemoConfig, step: string, command: string): Promise<Capture> {
    const root = await realpath(process.cwd());
    ensure(!path.isAbsolute(output) && /^artifacts\/local\/testnet\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(output), "NEW_IGNORED_CAPTURE_PATH_REQUIRED");
    let parent = root;
    for (const segment of ["artifacts", "local", "testnet"]) {
      parent = path.join(parent, segment);
      await mkdir(parent, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
      ensure((await lstat(parent)).isDirectory() && !(await lstat(parent)).isSymbolicLink(), "UNSAFE_CAPTURE_PARENT");
    }
    const directory = path.join(root, output);
    await mkdir(directory, { mode: 0o700 }); // Never overwrite or reuse a capture, including interrupted setup.
    const c = new Capture(directory, structuredClone(config), step, command);
    await c.put("intent.json", "intent", { schema_version: 1, step, command, config_sha256: sha256(JSON.stringify(config)), warning: "Do not retry a mutating step after an uncertain result. Resolve its saved transaction first." });
    await c.put("public-config.json", "configuration", config);
    return c;
  }
  async put(name: string, kind: string, value: unknown): Promise<void> {
    ensure(/^[a-z0-9][a-z0-9_.-]*\.json$/.test(name), "INVALID_ARTIFACT_NAME");
    publicOnly(value);
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    ensure(bytes.length <= 16 * 1024 * 1024, "ARTIFACT_TOO_LARGE");
    const file = await open(path.join(this.directory, name), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    const dir = await open(this.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await dir.sync(); } finally { await dir.close(); }
    this.artifacts.push({ path: name, sha256: sha256(bytes), kind });
  }
  readonly beforeBroadcast = async (transaction: TransactionLocator): Promise<void> => {
    await this.put("transaction-before-send.json", "transaction_locator", transaction);
  };
  get unresolvedBroadcast(): boolean { return this.artifacts.some((a) => a.kind === "transaction_locator") && !this.artifacts.some((a) => a.kind === "final_transaction"); }
  async query(client: AgentTrustClient, name: string, params: Record<string, unknown>): Promise<unknown> {
    ensure(params.finality === "final", "FINAL_QUERY_REQUIRED");
    const response: unknown = await client.provider.sendJsonRpc("query", params as never);
    ensure(object(response) && typeof response.block_hash === "string" && Number.isSafeInteger(response.block_height), "INVALID_FINAL_QUERY");
    await this.put(name, "final_query", { request: { method: "query", params }, response });
    return response;
  }
  async transaction(client: AgentTrustClient, locator: TransactionLocator): Promise<void> {
    const params = { ...locator, wait_until: "FINAL" as const };
    const response: unknown = await client.provider.sendJsonRpc("EXPERIMENTAL_tx_status", params);
    finalTransaction(response, locator);
    await this.put("final-transaction.json", "final_transaction", { request: { method: "EXPERIMENTAL_tx_status", params }, response });
  }
  async checkCore(client: AgentTrustClient): Promise<void> {
    await client.getConfig();
    const raw = await this.query(client, "core-account.json", { request_type: "view_account", account_id: this.config.core_account, finality: "final" });
    ensure(object(raw) && raw.code_hash === baseEncode(Buffer.from(this.config.expected_wasm_sha256, "hex")), "CORE_CODE_HASH_MISMATCH");
    await this.query(client, "core-config.json", { request_type: "call_function", account_id: this.config.core_account, method_name: "get_config", args_base64: Buffer.from("{}").toString("base64"), finality: "final" });
  }
  async finish(status: "passed" | "failed" | "uncertain" | "prepared", result: unknown, publicKey?: string): Promise<void> {
    await this.put("result.json", "step_result", result);
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).length !== 0;
    const lock = await readFile("pnpm-lock.yaml");
    const sdk = JSON.parse(await readFile("node_modules/near-api-js/package.json", "utf8")) as { version: string };
    await this.put("manifest.json", "manifest", {
      schema_version: 1, kind: "agenttrust_testnet_step", evidence_kind: "recorded_capture", captured_at: this.capturedAt,
      git_commit: commit, working_tree_dirty: dirty, config_sha256: sha256(JSON.stringify(this.config)), toolchain: { measured: { node: process.version, near_api_js: sdk.version }, configured_pins: { near_api_js: "7.4.0", pnpm: "10.33.0" }, lock_sha256: sha256(lock) },
      environment: { network: this.config.network, rpc_url: this.config.rpc_url, core_account: this.config.core_account, expected_wasm_sha256: this.config.expected_wasm_sha256 },
      actors: { owner: this.config.owner_id, issuer: this.config.issuer_id, provider_a: this.config.providers.a.service_id, provider_b: this.config.providers.b.service_id, ...(publicKey ? { signing_public_key_fingerprint: sha256(publicKey) } : {}) },
      step: this.step, command: this.command, status, exit_status: status === "passed" || status === "prepared" ? 0 : status === "uncertain" ? 2 : 1,
      artifacts: [...this.artifacts], native_runtime_gate: "user_run_required", remaining_gates: ["T13 native runtime cases and gaps", "Combine and review every required paid-flow case", "Two complete rehearsals"],
      limitations: ["This is one dated user-run testnet step, not the whole native runtime gate.", "RPC evidence is not a light-client proof; assertion truth still requires inspection.", "Controlled providers, project-operated issuer and synthetic fixture input."],
    });
  }
}
export function safeError(error: unknown): string { return error instanceof Error && /^[A-Z][A-Z0-9_]{1,100}$/.test(error.message) ? error.message : "DEMO_STEP_FAILED"; }
