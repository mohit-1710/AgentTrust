// Inspect fixture bytes only; never instantiate WASM or start Sandbox.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (process.argv.length !== 3) throw new Error('Usage: node scripts/check-runtime-helper.mjs <runtime-helper.wasm>');
const path = process.argv[2];
const bytes = await readFile(path);
if (!bytes.includes(Buffer.from('AGENTTRUST_RUNTIME_HELPER_ONLY'))) throw new Error('Missing runtime-only helper marker');
const module = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(module);
const exports = WebAssembly.Module.exports(module);
for (const name of ['current_account_id','predecessor_account_id','signer_account_id','promise_batch_create','promise_batch_action_delete_account','promise_batch_then','promise_batch_action_function_call']) {
  if (!imports.some(item=>item.module==='env'&&item.name===name)) throw new Error(`Missing helper host import ${name}`);
}
for (const name of ['forward_payment','delete_then_withdraw']) {
  if (!exports.some(item=>item.kind==='function'&&item.name===name)) throw new Error(`Missing helper export ${name}`);
}
for (const name of ['execute_payment','withdraw_available','on_payment_result','on_withdrawal_result']) {
  if (exports.some(item=>item.name===name)) throw new Error('Runtime helper cannot be a production core artifact');
}
console.log(JSON.stringify({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),artifact_kind:'runtime_test_helper',imports:imports.map(item=>`${item.module}.${item.name}`),exports:exports.map(item=>item.name),executed:false},null,2));
