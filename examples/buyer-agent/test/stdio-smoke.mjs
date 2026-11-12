// Explicit compiled buyer + MCP stdio smoke. Mock RPC only; no worker or model key.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runBuyer } from '../../../dist/examples/buyer-agent/src/loop.js';
import { scriptedDriver } from '../../../dist/examples/buyer-agent/src/model.js';
import { parseBuyerConfig } from '../../../dist/examples/buyer-agent/src/config.js';
import { parseMcpConfig } from '../../../dist/packages/mcp/src/config.js';
const invoice = JSON.parse(await readFile('fixtures/protocol/v1/vectors.json', 'utf8')).invoices[0].input;
const csv = 'vendor_id,invoice_id,amount,currency\nv1,i1,1.00,USD\n';
const hash = n => Buffer.alloc(32, n).toString('base64');
const service = { service_id: invoice.service_id, version: invoice.service_version, payout_account: invoice.payout_account, invoice_key: hash(7), endpoint_hash: invoice.endpoint_hash, active: true };
const rpcCalls = [];
const rpc = createServer(async (request, response) => {
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const call = JSON.parse(Buffer.concat(chunks)); rpcCalls.push({ method: call.method, view: call.params?.method_name });
    let result;
    if (call.method === 'status') result = { chain_id: 'testnet' };
    else {
      assert.equal(call.method, 'query'); assert.equal(call.params.finality, 'final'); assert.equal(call.params.account_id, invoice.core_account);
      const values = { get_config: { network: 'near:testnet', core_account: invoice.core_account, operating_reserve_yocto: '0' }, list_services: { items: [service], next_cursor: null }, get_policy: { owner_id: invoice.owner_id, revision: 1, paused: false, daily_cap_yocto: '100', max_dispatches_per_minute: 5, trusted_services: [], blocked_services: [], blocked_payouts: [] } };
      assert(Object.hasOwn(values, call.params.method_name)); result = { result: [...Buffer.from(JSON.stringify(values[call.params.method_name]))], block_hash: 'mock-final-block', block_height: 20 };
    }
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
  } catch { response.writeHead(500); response.end('Unexpected mock read'); }
});
await new Promise(resolve => rpc.listen(0, '127.0.0.1', resolve));
const root = await mkdtemp(join(tmpdir(), 'agenttrust-buyer-stdio-'));
const mcpPath = join(root, 'mcp.json');
const candidates = [{ service_id: service.service_id, payment_id: invoice.payment_id }, { service_id: 'alternative.testnet', payment_id: hash(9) }];
const mcp = parseMcpConfig({ schema_version: 1, network: 'near:testnet', core_account: invoice.core_account, rpc_url: `http://127.0.0.1:${rpc.address().port}`, owner_id: invoice.owner_id, session_id: invoice.session_id, attempts_directory: join(root, 'attempts'), catalog: candidates.map(c => ({ service_id: c.service_id, service_version: 1, origin: 'https://audit.example' })) });
await writeFile(mcpPath, JSON.stringify(mcp), { mode: 0o600 });
const config = parseBuyerConfig({ schema_version: 1, job_id: hash(8), mcp_config_file: mcpPath, job_directory: join(root, 'jobs'), csv_utf8: csv, candidates, mode: 'scripted', max_steps: 6, max_completion_tokens: 256 });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/packages/mcp/src/run-server.js'), '--config', mcpPath], env: { PATH: process.env.PATH ?? '' }, stderr: 'pipe' });
const errors = []; transport.stderr.on('data', chunk => errors.push(chunk.toString()));
const client = new Client({ name: 'buyer-stdio-mock-smoke', version: '1' }); const toolCalls = [];
try {
  await client.connect(transport, { timeout: 10_000 });
  const api = { listTools: () => client.listTools({}, { timeout: 10_000 }), callTool: args => { toolCalls.push(args.name); return client.callTool(args, undefined, { timeout: 10_000 }); } };
  const result = await runBuyer({ config, mcp, client: api, driver: scriptedDriver(config), gitCommit: 'unavailable' });
  assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'tool_error_or_malformed_result'); assert.equal(result.model_responses, 0);
  assert.deepEqual(toolCalls, ['list_services', 'get_policy', 'pay_service']);
  const alternate = { next: async () => ({ call: { name: 'pay_service', arguments: { serviceId: candidates[1].service_id, paymentId: candidates[1].payment_id, csvUtf8: csv } } }) };
  assert.equal((await runBuyer({ config, mcp, client: api, driver: alternate, gitCommit: 'unavailable' })).reason, 'attempt_boundary_violation');
  assert.equal(toolCalls.length, 3); assert.equal(errors.join(''), ''); assert(rpcCalls.every(c => c.method === 'query' || c.method === 'status'));
  const records = await Promise.all((await readdir(config.job_directory)).map(async name => ({ name, record: JSON.parse(await readFile(join(config.job_directory, name), 'utf8')) })));
  const capture = { evidence: 'scripted buyer plus actual MCP stdio and mock RPC only; no native payment or autonomous model', at: new Date().toISOString(), tool_calls: toolCalls, rpc_calls: rpcCalls, result, records };
  assert(!JSON.stringify(capture).includes(csv));
  await mkdir('artifacts/local/buyer', { recursive: true }); const path = `artifacts/local/buyer/stdio-mock-${Date.now()}.json`; await writeFile(path, JSON.stringify(capture, null, 2));
  console.log(`Mock-only buyer stdio capture: ${path}; no payment/model execution, original selection survives restart.`);
} finally { await client.close(); await new Promise(resolve => rpc.close(resolve)); await rm(root, { recursive: true, force: true }); }
