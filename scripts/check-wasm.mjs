import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/check-wasm.mjs <contract.wasm>");
const bytes = await readFile(path);
const module = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(module);
const exports = WebAssembly.Module.exports(module);
for (const name of ["current_account_id", "read_register", "value_return"]) {
  if (!imports.some((item) => item.module === "env" && item.name === name)) {
    throw new Error(`Missing NEAR host import env.${name}; check cfg(near).`);
  }
}
if (!exports.some((item) => item.name === "current_account" && item.kind === "function")) {
  throw new Error("Missing T02 current_account contract export.");
}
console.log(JSON.stringify({
  path,
  bytes: bytes.length,
  imports: imports.map((item) => `${item.module}.${item.name}`),
  exports: exports.map((item) => item.name),
  executed: false,
}, null, 2));
