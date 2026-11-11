import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const path = process.argv[2];
const faultBuild = process.argv[3] === "--runtime-test-callback-failure";
if (!path || process.argv.length > 4 || (process.argv[3] && !faultBuild)) {
  throw new Error("Usage: node scripts/check-wasm.mjs <contract.wasm> [--runtime-test-callback-failure]");
}
const bytes = await readFile(path);
if (bytes.includes(Buffer.from("RUNTIME_TEST_CALLBACK_FAILURE")) !== faultBuild) {
  throw new Error("Callback-fault marker does not match the explicitly requested artifact kind.");
}
const module = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(module);
const exports = WebAssembly.Module.exports(module);
for (const name of ["current_account_id", "predecessor_account_id", "signer_account_id", "signer_account_pk", "attached_deposit", "account_balance", "storage_usage", "read_register", "value_return", "storage_read", "storage_write", "ed25519_verify", "promise_batch_create", "promise_batch_action_transfer", "promise_results_count", "promise_result", "promise_batch_then", "promise_batch_action_function_call"]) {
  if (faultBuild && name === "promise_result") continue; // Fault panics before result handling.
  if (!imports.some((item) => item.module === "env" && item.name === name)) {
    throw new Error(`Missing NEAR host import env.${name}; check cfg(near).`);
  }
}
for (const name of ["new", "deposit", "get_account", "set_policy", "set_profile", "register_session", "revoke_session", "get_config", "get_policy", "get_session", "set_service", "issue_credential", "revoke_credential", "get_service", "get_credential", "set_service_trust", "block_service", "block_payout", "execute_payment", "get_payment", "on_payment_result"]) {
  if (!exports.some((item) => item.name === name && item.kind === "function")) {
    throw new Error(`Missing native contract export ${name}.`);
  }
}
console.log(JSON.stringify({
  path,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  artifact_kind: faultBuild ? "runtime_test_callback_failure" : "production",
  imports: imports.map((item) => `${item.module}.${item.name}`),
  exports: exports.map((item) => item.name),
  executed: false,
}, null, 2));
