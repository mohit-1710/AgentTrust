// Actual compiled CLI, with a preloaded deny-all network/process guard. Ordinary temp files only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runBuyer } from '../../../dist/examples/buyer-agent/src/loop.js';
import { digest } from '../../../dist/examples/buyer-agent/src/journal.js';
import { auditCsv } from '../../../dist/examples/invoice-audit/src/audit.js';
import { invoiceHash, requestHash } from '../../../dist/packages/near-sdk/src/codec.js';
import { endpointHash } from '../../../dist/packages/near-sdk/src/directory.js';

const root = await mkdtemp(join(tmpdir(), 'agenttrust-buyer-replay-'));
const guard = join(root, 'deny-execution.mjs'), observed = join(root, 'guard.txt');
// The guard loads before the CLI or any dependencies. Even a regression cannot reach an
// RPC, model endpoint, signer subprocess or MCP child. Git provenance is a local stub.
await writeFile(guard, `
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import child from 'node:child_process';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
const file = process.env.AGENTTRUST_TEST_GUARD_FILE;
appendFileSync(file, 'guard-active\\n');
const deny = () => { appendFileSync(file, 'forbidden-execution\\n'); throw new Error('TEST_EXECUTION_FORBIDDEN'); };
globalThis.fetch = deny;
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'fork']) child[name] = deny;
child.execFileSync = (command, args) => command === 'git' && args.length === 4 && args[0] === '-C' && args[2] === 'rev-parse' && args[3] === 'HEAD' ? 'unavailable\\n' : deny();
net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = deny;
http.request = http.get = https.request = https.get = deny;
syncBuiltinESMExports();
`, { mode: 0o600 });
const csv = 'vendor_id,invoice_id,amount,currency\nv1,i1,2.50,USD\nv1,i1,3.50,USD\n';
const hash = n => Buffer.alloc(32, n).toString('base64');
const names = ['list_services', 'get_service', 'get_policy', 'preview_payment', 'pay_service', 'get_payment'];
const unusedKeys = { AGENTTRUST_WORKER_PRIVATE_KEY: 'unused-secret-worker', NEAR_AI_API_KEY: 'unused-secret-model' };
let number = 0, checks = 0;
async function setup(mode = 'near-ai', terminal = true) {
  const prefix = String(number++), mcpPath = join(root, `${prefix}-mcp.json`), configPath = join(root, `${prefix}-buyer.json`);
  const candidate = { service_id: 'merchant.testnet', payment_id: hash(2) };
  const config = { schema_version: 1, job_id: hash(3), mcp_config_file: mcpPath, job_directory: join(root, `${prefix}-jobs`), csv_utf8: csv, candidates: [candidate], mode, ...(mode === 'near-ai' ? { model: 'explicit/model' } : mode === 'local-model' ? { model: 'qwen3:4b-instruct' } : {}), max_steps: 3, max_completion_tokens: 256 };
  const mcp = { schema_version: 1, network: 'near:testnet', core_account: 'core.testnet', rpc_url: 'https://rpc.invalid', owner_id: 'owner.testnet', session_id: hash(1), attempts_directory: join(root, `${prefix}-attempts`), catalog: [{ service_id: candidate.service_id, service_version: 1, origin: 'https://audit.example' }] };
  const invoice = { schema_version: 1, network: mcp.network, core_account: mcp.core_account, owner_id: mcp.owner_id, session_id: mcp.session_id, payment_id: candidate.payment_id, policy_revision: 1, profile_id: 'audit', profile_revision: 1, service_id: candidate.service_id, service_version: 1, payout_account: 'payee.testnet', endpoint_hash: endpointHash(mcp.catalog[0].origin), request_hash: requestHash(csv), asset: 'NEAR', amount_yocto: '10', issued_at_ns: '1800000000000000000', expires_at_ns: '1800000120000000000' };
  const paid = { kind: 'paid', payment: { invoice, invoice_hash: invoiceHash(invoice), credential: null, dispatched_at_ns: invoice.issued_at_ns, dispatch_day: '0', dispatch_minute: '0', state: 'settled', finalized_at_ns: '1800000000000000001', display_state: 'settled' }, block: { finality: 'final', block_hash: 'mock-final-block', block_height: 100 }, transaction: { tx_hash: '1'.repeat(32), sender_account_id: mcp.owner_id }, receipt_ids: ['1'.repeat(32)], report: auditCsv(csv), output_check: { ok: true } };
  await writeFile(mcpPath, JSON.stringify(mcp), { mode: 0o600 });
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  let calls = 0;
  const initial = await runBuyer({ config, mcp, gitCommit: 'unavailable', driver: { next: async () => ({ call: { name: 'pay_service', arguments: { serviceId: candidate.service_id, paymentId: candidate.payment_id, csvUtf8: csv } } }) }, client: { listTools: async () => ({ tools: names.map(name => ({ name, inputSchema: {} })) }), callTool: async () => { calls++; return { structuredContent: { result: terminal ? paid : { kind: 'uncertain', payment_id: candidate.payment_id, reason: 'pending' } } }; } } });
  assert.equal(initial.kind, terminal ? 'paid' : 'stopped'); assert.equal(calls, 1);
  const record = name => join(config.job_directory, `${digest(config.job_id)}.${name}.json`);
  return { config, configPath, paid, record };
}
async function invoke(fixture, env = {}, expectedStatus = 0) {
  await writeFile(observed, '');
  const child = spawnSync(process.execPath, ['--import', guard, resolve('dist/examples/buyer-agent/src/run.js'), '--config', fixture.configPath, '--execute'], { env: { PATH: process.env.PATH ?? '', AGENTTRUST_TEST_GUARD_FILE: observed, ...env }, encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 });
  assert.equal(child.error, undefined); assert.equal(child.signal, null);
  assert.equal(await readFile(observed, 'utf8'), 'guard-active\n', 'CLI attempted network or a subprocess');
  assert.equal(child.status, expectedStatus, child.stderr);
  assert(!child.stdout.includes('unused-secret')); assert(!child.stderr.includes('unused-secret'));
  checks++;
  return child.stdout ? JSON.parse(child.stdout) : null;
}
async function expectReplay(fixture, env) {
  const before = await Promise.all(['context', 'selection-0', 'outcome-0'].map(name => readFile(fixture.record(name), 'utf8')));
  const result = await invoke(fixture, env);
  assert.equal(result.kind, 'paid'); assert.equal(result.mode, fixture.config.mode); assert.equal(result.evidence, 'recorded_replay');
  assert.equal(result.replayed, true); assert.equal(result.model_responses, 0); assert.deepEqual(result.report, fixture.paid.report); assert.deepEqual(result.payment, fixture.paid.payment);
  assert.deepEqual(await Promise.all(['context', 'selection-0', 'outcome-0'].map(name => readFile(fixture.record(name), 'utf8'))), before);
  const records = await Promise.all((await readdir(fixture.config.job_directory)).map(async name => JSON.parse(await readFile(join(fixture.config.job_directory, name), 'utf8'))));
  assert.deepEqual(records.filter(record => record.run_id === result.run_id).map(record => record.event), ['started', 'completed_replay']);
}
try {
  const nearAi = await setup();
  await expectReplay(nearAi);
  await expectReplay(nearAi, unusedKeys);
  await expectReplay(await setup('local-model'), unusedKeys);
  await expectReplay(await setup('scripted'));

  const wrongReport = await setup();
  wrongReport.paid.report.currency_totals[0].amount = '999.00';
  await writeFile(wrongReport.record('outcome-0'), JSON.stringify(wrongReport.paid));
  assert.equal((await invoke(wrongReport, unusedKeys, 2)).kind, 'stopped');
  const wrongPayment = await setup();
  wrongPayment.paid.payment.invoice.owner_id = 'foreign.testnet';
  wrongPayment.paid.payment.invoice_hash = invoiceHash(wrongPayment.paid.payment.invoice);
  await writeFile(wrongPayment.record('outcome-0'), JSON.stringify(wrongPayment.paid));
  assert.equal((await invoke(wrongPayment, unusedKeys, 2)).kind, 'stopped');
  const corrupt = await setup();
  await writeFile(corrupt.record('outcome-0'), '{broken');
  assert.equal((await invoke(corrupt, unusedKeys, 2)).kind, 'stopped');
  const badSelection = await setup();
  await writeFile(badSelection.record('selection-0'), JSON.stringify({ candidate: 99 }));
  assert.equal((await invoke(badSelection, unusedKeys, 2)).reason, 'invalid_job_record');
  const changed = await setup();
  await writeFile(changed.configPath, JSON.stringify({ ...changed.config, csv_utf8: csv.replace('2.50', '2.51') }));
  assert.equal((await invoke(changed, unusedKeys, 2)).reason, 'job_context_conflict');
  const invalidConfig = await setup();
  await writeFile(invalidConfig.configPath, JSON.stringify({ ...invalidConfig.config, unknown: true }));
  assert.equal(await invoke(invalidConfig, {}, 1), null);

  const unfinished = await setup('near-ai', false);
  const selection = await readFile(unfinished.record('selection-0'), 'utf8');
  for (const env of [{}, { AGENTTRUST_WORKER_PRIVATE_KEY: 'unused-secret-worker' }]) {
    const result = await invoke(unfinished, env, 2);
    assert.equal(result.kind, 'stopped'); assert.equal(result.model_responses, 0); assert.equal(result.evidence, 'no_model_response_this_run');
    assert.equal(await readFile(unfinished.record('selection-0'), 'utf8'), selection);
    await assert.rejects(readFile(unfinished.record('outcome-0')), { code: 'ENOENT' });
    const traces = (await readdir(unfinished.config.job_directory)).filter(name => name.includes(`.run-${result.run_id}-`));
    assert.deepEqual(await Promise.all(traces.map(async name => JSON.parse(await readFile(join(unfinished.config.job_directory, name), 'utf8')).event)), ['started', 'stopped']);
  }
  const unfinishedLocal = await setup('local-model', false);
  const localResult = await invoke(unfinishedLocal, {}, 2);
  assert.equal(localResult.kind, 'stopped'); assert.equal(localResult.model_responses, 0); assert.equal(localResult.evidence, 'no_model_response_this_run');
  await assert.rejects(readFile(unfinishedLocal.record('outcome-0')), { code: 'ENOENT' });
  console.log(`Compiled buyer replay: ${checks} guarded CLI checks passed; mock saved outcomes only, zero network/model/signing/MCP execution.`);
} finally { await rm(root, { recursive: true, force: true }); }
