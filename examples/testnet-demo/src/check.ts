/** Read-only structural/integrity check. It never converts a dated capture into a new runtime pass. */
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { baseEncode } from "near-api-js";
import { validateTransactionLocator } from "../../../packages/near-sdk/src/attempts.js";
import { sha256, validateConfig } from "./config.js";
import { ensure, finalTransaction, publicOnly, safeError } from "./capture.js";

const object = (v: unknown): Record<string, unknown> => { ensure(v && typeof v === "object" && !Array.isArray(v), "EXPECTED_OBJECT"); return v as Record<string, unknown>; };
async function jsonFile(file: string) {
  const stat = await lstat(file);
  ensure(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 16 * 1024 * 1024, "UNSAFE_EVIDENCE_FILE");
  const bytes = await readFile(file);
  const value: unknown = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
  publicOnly(value); return { bytes, value };
}
function finalView(value: unknown): void {
  const v = object(value), request = object(v.request), params = object(request.params), response = object(v.response);
  ensure(request.method === "query" && params.finality === "final" && typeof response.block_hash === "string" && Number.isSafeInteger(response.block_height) && !Object.hasOwn(response, "error"), "FINAL_QUERY_REQUIRED");
}
function viewValue(value: unknown): unknown {
  const response = object(object(value).response);
  ensure(Array.isArray(response.result) && response.result.every((b) => Number.isInteger(b) && b >= 0 && b <= 255), "INVALID_VIEW_BYTES");
  return JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(Uint8Array.from(response.result)));
}
export async function checkTestnetEvidence(file: string) {
  const manifest = object((await jsonFile(file)).value);
  ensure(manifest.schema_version === 1 && manifest.kind === "agenttrust_testnet_step" && manifest.evidence_kind === "recorded_capture", "INVALID_MANIFEST");
  ensure(typeof manifest.captured_at === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(manifest.captured_at) && Number.isFinite(Date.parse(manifest.captured_at)), "INVALID_CAPTURE_TIME");
  ensure(typeof manifest.git_commit === "string" && /^[a-f0-9]{40}$/.test(manifest.git_commit) && typeof manifest.working_tree_dirty === "boolean", "INVALID_SOURCE_ANCHOR");
  ensure(typeof manifest.command === "string" && manifest.command.includes("--user-run") && typeof manifest.step === "string", "EXECUTED_COMMAND_REQUIRED");
  ensure(["passed", "failed", "uncertain", "prepared"].includes(manifest.status as string) && manifest.exit_status === (manifest.status === "failed" ? 1 : manifest.status === "uncertain" ? 2 : 0), "INCONSISTENT_STEP_STATUS");
  ensure(manifest.native_runtime_gate === "user_run_required" && Array.isArray(manifest.remaining_gates) && manifest.remaining_gates.length > 0, "WHOLE_RUNTIME_GATE_UNPROVEN");
  const toolchain = object(manifest.toolchain); object(toolchain.measured); object(toolchain.configured_pins);
  ensure(typeof toolchain.lock_sha256 === "string" && /^[a-f0-9]{64}$/.test(toolchain.lock_sha256), "LOCK_HASH_REQUIRED");
  const directory = path.dirname(await realpath(file));
  const artifacts = new Map<string, unknown>(), kinds = new Set<string>();
  ensure(Array.isArray(manifest.artifacts), "ARTIFACTS_REQUIRED");
  const validKinds = ["intent", "configuration", "transaction_locator", "final_query", "final_transaction", "step_result", "validator_result", "synthetic_fixture", "paid_sdk_result", "signed_attempt", "submission_result", "sdk_preview_result"];
  for (const item of manifest.artifacts) {
    const ref = object(item);
    ensure(typeof ref.path === "string" && /^[a-z0-9][a-z0-9_.-]*\.json$/.test(ref.path) && ref.path !== "manifest.json" && !artifacts.has(ref.path), "UNSAFE_ARTIFACT_PATH");
    ensure(typeof ref.kind === "string" && validKinds.includes(ref.kind) && typeof ref.sha256 === "string" && /^[a-f0-9]{64}$/.test(ref.sha256), "INVALID_ARTIFACT_REFERENCE");
    const artifact = await jsonFile(path.join(directory, ref.path));
    ensure(sha256(artifact.bytes) === ref.sha256, "ARTIFACT_HASH_MISMATCH");
    if (ref.kind === "final_query") finalView(artifact.value);
    if (ref.kind === "final_transaction") {
      const value = object(artifact.value), request = object(value.request), params = object(request.params);
      ensure(request.method === "EXPERIMENTAL_tx_status" && params.wait_until === "FINAL", "FINAL_TRANSACTION_REQUEST_REQUIRED");
      const locator = { tx_hash: params.tx_hash, sender_account_id: params.sender_account_id };
      ensure(typeof params.sender_account_id === "string", "TRANSACTION_SENDER_REQUIRED");
      validateTransactionLocator(locator, params.sender_account_id); finalTransaction(value.response, locator);
    }
    artifacts.set(ref.path, artifact.value); kinds.add(ref.kind);
  }
  const config = validateConfig(artifacts.get("public-config.json"));
  ensure(manifest.config_sha256 === sha256(JSON.stringify(config)) && object(artifacts.get("intent.json")).config_sha256 === manifest.config_sha256, "CONFIGURATION_HASH_MISMATCH");
  const env = object(manifest.environment);
  ensure(env.network === config.network && env.core_account === config.core_account && env.rpc_url === config.rpc_url && env.expected_wasm_sha256 === config.expected_wasm_sha256, "CAPTURE_DOMAIN_MISMATCH");
  const result = object(artifacts.get("result.json"));
  if (manifest.status === "passed") {
    ensure(kinds.has("final_transaction") && kinds.has("final_query"), "PASSED_STEP_REQUIRES_CHAIN_EVIDENCE");
    const raw = object(object(artifacts.get("final-transaction.json")).response);
    ensure(Object.hasOwn(object(raw.status), "SuccessValue"), "PASSED_TRANSACTION_CANNOT_FAIL");
    const core = object(object(artifacts.get("core-account.json")).response);
    ensure(core.code_hash === baseEncode(Buffer.from(config.expected_wasm_sha256, "hex")), "CORE_CODE_HASH_MISMATCH");
    if (kinds.has("synthetic_fixture")) {
      ensure(result.asserted === true && typeof result.observed_payout_delta_yocto === "string", "PAID_FLOW_ASSERTIONS_REQUIRED");
      const payment = viewValue(artifacts.get("payment-after.json"));
      if (kinds.has("paid_sdk_result")) {
        const paid = object(artifacts.get("sdk-result.json")), settled = object(payment), input = object(artifacts.get("input-commitment.json"));
        ensure(paid.kind === "paid" && object(paid.output_check).ok === true && settled.state === "settled" && settled.invoice_hash === object(paid.payment).invoice_hash && object(settled.invoice).request_hash === input.request_hash, "SETTLED_CHECKED_OUTPUT_REQUIRED");
        ensure(object(result.case_result).output_sha256 === sha256(JSON.stringify(paid.report)), "OUTPUT_HASH_MISMATCH");
      } else {
        const rejected = object(result.case_result), submission = object(rejected.submission), admission = object(submission.admission);
        ensure(payment === null && result.observed_payout_delta_yocto === "0" && rejected.origin === "executed_rejection" && submission.kind === "final" && admission.kind === "rejected" && object(admission.decision).code === rejected.expected_code, "EXECUTED_REFUSAL_REQUIRED");
      }
    } else ensure(artifacts.has("setup-state.json"), "SETUP_FINAL_STATE_REQUIRED");
  }
  return { evidence_kind: "recorded_capture" as const, captured_at: manifest.captured_at, step: manifest.step, reported_status: manifest.status, artifact_count: artifacts.size, native_runtime_gate: "user_run_required" as const, limitations: ["Read-only structure, binding and local artifact hashes checked; inspect actual RPC outcomes before accepting assertions.", "A dated capture is not a new execution or a light-client proof. Two full rehearsals and the separate native runtime gate remain required."] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length === 3 && process.argv[2] === "--help") console.log("Usage: pnpm demo:evidence:check artifacts/local/testnet/STEP/manifest.json\nRead-only; labels original capture time and never claims the whole runtime gate passed.");
  else checkTestnetEvidence(process.argv.length === 3 ? process.argv[2]! : "").then((result) => { console.log(JSON.stringify(result, null, 2)); process.exitCode = result.reported_status === "passed" || result.reported_status === "prepared" ? 0 : 2; }).catch((error: unknown) => { console.error(safeError(error)); process.exitCode = 1; });
}
