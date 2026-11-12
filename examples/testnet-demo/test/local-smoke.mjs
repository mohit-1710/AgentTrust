// Real compiled local listeners; synthetic offline configuration, no chain or model call.
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseEncode } from 'near-api-js';
import { renderPublicConfigs } from '../../../dist/examples/testnet-demo/src/config.js';
import { prepareLocal, startLocal, checkPorts } from '../../../dist/examples/testnet-demo/src/local.js';
import { verifyInvoiceSignature } from '../../../dist/packages/near-sdk/src/codec.js';
const directory = await mkdtemp(join(tmpdir(), 'agenttrust-stack-smoke-'));
let running;
try {
  const certFile = join(directory, 'localhost.crt'), keyFile = join(directory, 'localhost.key');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-keyout', keyFile, '-out', certFile], { stdio: 'ignore' });
  await chmod(keyFile, 0o600); const cert = await readFile(certFile);
  const seeds = { a: randomBytes(32), b: randomBytes(32) };
  const invoiceKey = (seed) => createPublicKey(createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), type: 'pkcs8', format: 'der' })).export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
  const hash = (n) => Buffer.alloc(32, n).toString('base64');
  const provider = (label, port) => ({ service_id: `${label}.testnet`, payout_account: `${label}-pay.testnet`, invoice_key: invoiceKey(seeds[label]), origin: `https://localhost:${port}`, amount_yocto: '2000000000000000000000', port });
  const config = { schema_version: 1, network: 'near:testnet', rpc_url: 'https://rpc.invalid', core_account: 'core.testnet', expected_wasm_sha256: 'ab'.repeat(32), owner_id: 'owner.testnet', issuer_id: 'issuer.testnet', worker_public_key: `ed25519:${baseEncode(Buffer.alloc(32, 1))}`, session_id: hash(1), profile_id: 'invoice-audit', session_expires_at_ns: '2000000000000000000', credential_id: hash(2), credential_expires_at_ns: '2000000000000000000', attempts_directory: join(directory, 'attempts'), rotated_payout_account: 'rotated.testnet', providers: { a: provider('a', 4041), b: provider('b', 4042) }, payment_ids: { missing: hash(10), paid: hash(11), revoked: hash(12), identity: hash(13) } };
  const rendered = renderPublicConfigs(config);
  for (const p of [rendered.provider_a, rendered.provider_b]) p.tls = { cert_file: certFile, key_file: keyFile };
  for (const [name, value] of Object.entries({ 'demo.json': config, 'provider-a.json': rendered.provider_a, 'provider-b.json': rendered.provider_b, 'mcp.json': rendered.mcp })) await writeFile(join(directory, name), JSON.stringify(value), { mode: 0o600 });
  const plan = await prepareLocal(directory, process.cwd(), { PATH: process.env.PATH, AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64: seeds.a.toString('base64'), AGENTTRUST_PROVIDER_B_INVOICE_SEED_BASE64: seeds.b.toString('base64') });
  running = await startLocal(plan);
  const quote = (label) => new Promise((resolve, reject) => {
    const context = { owner_id: config.owner_id, session_id: config.session_id, payment_id: config.payment_ids.paid, policy_revision: 1, profile_id: config.profile_id, profile_revision: 1 };
    const req = request(`${config.providers[label].origin}/v1/invoice-audit`, { method: 'POST', family: 4, ca: cert, timeout: 3000, headers: { 'content-type': 'application/json' } }, (res) => { const parts = []; res.on('data', (part) => parts.push(part)); res.on('end', () => { try { assert.equal(res.statusCode, 402); resolve(JSON.parse(Buffer.concat(parts))); } catch (error) { reject(error); } }); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('LOCAL_QUOTE_TIMEOUT')));
    req.end(JSON.stringify({ mode: 'quote', csv_utf8: 'vendor_id,invoice_id,amount,currency\n', context }));
  });
  for (const label of ['a', 'b']) { const result = await quote(label); assert(verifyInvoiceSignature(result.quote, config.providers[label].invoice_key)); assert.equal(result.quote.invoice.service_id, config.providers[label].service_id); }
  const web = await fetch('http://127.0.0.1:3000'); assert.equal(web.status, 200); assert.match(await web.text(), /AgentTrust/);
  const docs = await fetch('http://127.0.0.1:3001/docs'); assert.equal(docs.status, 200); assert.match(await docs.text(), /AgentTrust/);
  assert.deepEqual(await (await fetch('http://127.0.0.1:3001/api/ask')).json(), { available: false });
  await running.stop(); running = undefined; await checkPorts(plan.services);
  console.log('Compiled local stack passed: two trusted HTTPS providers, two valid signed quotes, web/docs HTTP, disabled assistant and released ports. Synthetic configuration only; chain/model/browser not exercised.');
} finally { await running?.stop(); await rm(directory, { recursive: true, force: true }); }
