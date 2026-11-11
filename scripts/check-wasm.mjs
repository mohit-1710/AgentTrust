import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/check-wasm.mjs <contract.wasm>");
const bytes = await readFile(path);
const module = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(module);
const exports = WebAssembly.Module.exports(module);
for (const name of ["current_account_id", "predecessor_account_id", "signer_account_id", "signer_account_pk", "attached_deposit", "account_balance", "storage_usage", "read_register", "value_return", "storage_read", "storage_write"]) {
  if (!imports.some((item) => item.module === "env" && item.name === name)) {
    throw new Error(`Missing NEAR host import env.${name}; check cfg(near).`);
  }
}
for (const name of ["new", "deposit", "get_account", "set_policy", "set_profile", "register_session", "revoke_session", "get_config", "get_policy", "get_session", "set_service", "issue_credential", "revoke_credential", "get_service", "get_credential"]) {
  if (!exports.some((item) => item.name === name && item.kind === "function")) {
    throw new Error(`Missing native contract export ${name}.`);
  }
}
console.log(JSON.stringify({
  path,
  bytes: bytes.length,
  imports: imports.map((item) => `${item.module}.${item.name}`),
  exports: exports.map((item) => item.name),
  executed: false,
}, null, 2));
