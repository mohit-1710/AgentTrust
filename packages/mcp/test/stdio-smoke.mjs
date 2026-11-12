// Explicit local stdio smoke: synthetic values and in-memory mock RPC only; never a chain.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const invoice = JSON.parse(await readFile('fixtures/protocol/v1/vectors.json', 'utf8')).invoices[0].input;
const hash = (n) => Buffer.alloc(32, n).toString('base64');
const quote = { invoice, signature: Buffer.alloc(64).toString('base64') };
const service = { service_id: invoice.service_id, version: invoice.service_version, payout_account: invoice.payout_account, invoice_key: hash(7), endpoint_hash: invoice.endpoint_hash, active: true };
const policy = { owner_id: invoice.owner_id, revision: 1, paused: false, daily_cap_yocto: '100', max_dispatches_per_minute: 5, trusted_services: [], blocked_services: [], blocked_payouts: [] };
const rpcCalls = [];
const rpc = createServer(async (request, response) => {
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const call = JSON.parse(Buffer.concat(chunks).toString('utf8')); rpcCalls.push({ method: call.method, view: call.params?.method_name });
    let result;
    if (call.method === 'status') result = { chain_id: 'testnet' };
    else {
      assert.equal(call.method, 'query'); assert.equal(call.params.finality, 'final');
      assert.equal(call.params.account_id, invoice.core_account);
      const args = JSON.parse(Buffer.from(call.params.args_base64, 'base64').toString('utf8'));
      const values = { get_config: { network: 'near:testnet', core_account: invoice.core_account, operating_reserve_yocto: '0' }, list_services: { items: [service], next_cursor: null }, get_service: service, get_policy: policy, get_payment: null, preview_payment: { authorization: 'not_proven_by_view', decision: { kind: 'deny', code: 'INVALID_INVOICE' } } };
      assert(Object.hasOwn(values, call.params.method_name));
      if (['get_policy', 'get_payment'].includes(call.params.method_name)) assert.equal(args.owner_id, invoice.owner_id);
      result = { result: [...Buffer.from(JSON.stringify(values[call.params.method_name]))], block_hash: 'mock-final-block', block_height: 20 };
    }
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
  } catch { response.writeHead(500); response.end('Unexpected mock RPC request'); }
});
await new Promise((resolve) => rpc.listen(0, '127.0.0.1', resolve));
const root = await mkdtemp(join(tmpdir(), 'agenttrust-mcp-stdio-'));
const config = { schema_version: 1, network: 'near:testnet', core_account: invoice.core_account, rpc_url: `http://127.0.0.1:${rpc.address().port}`, owner_id: invoice.owner_id, session_id: invoice.session_id, attempts_directory: join(root, 'attempts'), catalog: [] };
const configPath = join(root, 'mcp.json'); await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/packages/mcp/src/run-server.js'), '--config', configPath], cwd: process.cwd(), env: { PATH: process.env.PATH ?? '' }, stderr: 'pipe' });
const transcript = [], errors = [];
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'csvUtf8' && typeof item === 'string' ? { redacted: true, bytes: Buffer.byteLength(item), sha256: createHash('sha256').update(item).digest('hex') } : redact(item)]));
  return value;
}
const send = transport.send.bind(transport); transport.send = async (message) => { transcript.push({ direction: 'client_to_server', message: redact(message) }); return send(message); };
const start = transport.start.bind(transport); transport.start = async () => { const receive = transport.onmessage; transport.onmessage = (message, extra) => { transcript.push({ direction: 'server_to_client', message: redact(message) }); receive?.(message, extra); }; await start(); };
transport.stderr?.on('data', (chunk) => errors.push(chunk.toString()));
const client = new Client({ name: 'agenttrust-stdio-smoke', version: '1' });
try {
  await client.connect(transport, { timeout: 10_000 });
  const { tools } = await client.listTools({}, { timeout: 10_000 }); assert.equal(tools.length, 6);
  const call = async (name, args = {}) => (await client.callTool({ name, arguments: args }, undefined, { timeout: 10_000 }));
  assert.equal((await call('list_services')).structuredContent.result.items[0].configured, false);
  assert.deepEqual((await call('get_service', { serviceId: service.service_id })).structuredContent.result, service);
  assert.deepEqual((await call('get_policy')).structuredContent.result, policy);
  assert.deepEqual((await call('preview_payment', { quote, credential: null })).structuredContent.result, { authorization: 'not_proven_by_view', decision: { kind: 'deny', code: 'INVALID_INVOICE' } });
  assert.equal((await call('get_payment', { paymentId: invoice.payment_id })).structuredContent.result.reason, 'not_found');
  assert.equal((await call('pay_service', { serviceId: service.service_id, csvUtf8: 'vendor_id,invoice_id,amount,currency\n', paymentId: invoice.payment_id })).structuredContent.result.code, 'PAYMENT_NOT_CONFIGURED');
  assert.equal((await call('sign', { transaction: 'not allowed' })).isError, true);
  assert.equal(errors.join(''), ''); assert(rpcCalls.every((entry) => entry.method === 'status' || entry.method === 'query'));
  assert(transcript.some((entry) => entry.message.method === 'initialize'));
  assert(transcript.some((entry) => entry.message.method === 'notifications/initialized'));
  await mkdir('artifacts/local/mcp', { recursive: true });
  const capture = `artifacts/local/mcp/stdio-mock-${Date.now()}.json`;
  await writeFile(capture, JSON.stringify({ evidence: 'local stdio plus in-memory mock RPC only; no native payment execution', captured_at: new Date().toISOString(), server: client.getServerVersion(), rpc_calls: rpcCalls, transcript }, null, 2));
  console.log(`Mock-only protocol capture: ${capture}`);
  console.log('Actual compiled stdio initialize/list/6 calls/unknown-tool transcript passed; only mock RPC reads, no worker key or transaction.');
} finally { await client.close(); await new Promise((resolve) => rpc.close(resolve)); await rm(root, { recursive: true, force: true }); }
