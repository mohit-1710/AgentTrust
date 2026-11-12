import { createPrivateKey, createPublicKey } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { baseEncode } from "near-api-js";
import { renderPublicConfigs, type DemoConfig } from "../src/config.js";
import { checkPorts, localArguments, prepareLocal, serviceEnvironment, startLocal, type LocalPlan } from "../src/local.js";

const dirs: string[] = [];
const b64 = (n: number) => Buffer.alloc(32, n).toString("base64");
async function directory() { const dir = await mkdtemp(path.join(tmpdir(), "agenttrust-local-test-")); dirs.push(dir); return dir; }
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
function publicKey(n: number) { return createPublicKey(createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.alloc(32, n)]), type: "pkcs8", format: "der" })).export({ type: "spki", format: "der" }).subarray(-32).toString("base64"); }
async function fixture() {
  const dir = await directory(), cert = path.join(dir, "cert.pem"), key = path.join(dir, "key.pem");
  const generated = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", key, "-out", cert], { stdio: "ignore" });
  expect(generated.status).toBe(0);
  const { chmod } = await import("node:fs/promises"); await chmod(key, 0o600);
  const config: DemoConfig = { schema_version: 1, network: "near:testnet", rpc_url: "https://rpc.testnet.near.org", core_account: "core.testnet", expected_wasm_sha256: "ab".repeat(32), owner_id: "owner.testnet", issuer_id: "issuer.testnet", worker_public_key: `ed25519:${baseEncode(Buffer.alloc(32, 1))}`, session_id: b64(1), profile_id: "invoice-audit", session_expires_at_ns: "2000000000000000000", credential_id: b64(2), credential_expires_at_ns: "2000000000000000000", attempts_directory: path.join(dir, "attempts"), rotated_payout_account: "rotated.testnet", providers: { a: { service_id: "alpha.testnet", payout_account: "alpha-pay.testnet", invoice_key: publicKey(3), origin: "https://localhost:4041", amount_yocto: "2000000000000000000000", port: 4041 }, b: { service_id: "beta.testnet", payout_account: "beta-pay.testnet", invoice_key: publicKey(4), origin: "https://localhost:4042", amount_yocto: "2000000000000000000000", port: 4042 } }, payment_ids: { missing: b64(10), paid: b64(11), revoked: b64(12), identity: b64(13) } };
  const rendered = renderPublicConfigs(config);
  for (const value of [rendered.provider_a, rendered.provider_b]) value.tls = { cert_file: cert, key_file: key };
  for (const [name, value] of Object.entries({ "demo.json": config, "provider-a.json": rendered.provider_a, "provider-b.json": rendered.provider_b, "mcp.json": rendered.mcp })) await writeFile(path.join(dir, name), JSON.stringify(value));
  for (const file of ["dist/examples/invoice-audit/src/run-server.js", "web/.next/BUILD_ID", "docs-site/.next/BUILD_ID", "web/node_modules/next/dist/bin/next", "docs-site/node_modules/next/dist/bin/next"]) { await mkdir(path.dirname(path.join(dir, file)), { recursive: true }); await writeFile(path.join(dir, file), "fixture"); }
  return { dir, config, rendered, env: { AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64: b64(3), AGENTTRUST_PROVIDER_B_INVOICE_SEED_BASE64: b64(4) } };
}
it("isolates each provider seed and strips wallet, model, Node injection and database environment", () => {
  const source = { PATH: "/bin", HOME: "/wallet", NODE_OPTIONS: "--require=/bad", NODE_TLS_REJECT_UNAUTHORIZED: "0", DATABASE_URL: "db", AWS_SECRET_ACCESS_KEY: "aws", AGENTTRUST_SETUP_PRIVATE_KEY: "owner", AGENTTRUST_WORKER_PRIVATE_KEY: "worker", NEAR_AI_API_KEY: "model", AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64: "a", AGENTTRUST_PROVIDER_B_INVOICE_SEED_BASE64: "b" };
  expect(serviceEnvironment("a", source)).toEqual({ PATH: "/bin", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", AGENTTRUST_INVOICE_SEED_BASE64: "a" });
  expect(serviceEnvironment("b", source).AGENTTRUST_INVOICE_SEED_BASE64).toBe("b");
  expect(serviceEnvironment("web", source)).toEqual({ PATH: "/bin", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" });
  expect(serviceEnvironment("docs", source)).toEqual({ PATH: "/bin", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", ASK_AI_ENABLED: "false" });
});
it("refuses ambiguous starts", () => { for (const args of [[], ["--start"], ["--start", "--directory", "relative"], ["--start", "--directory", "/ok", "extra"]]) expect(() => localArguments(args)).toThrow(); expect(localArguments(["--check", "--directory", "/demo"])).toEqual({ start: false, directory: "/demo" }); });
it("checks two exact roles, TLS key pairs and builds without network or chain claims", async () => {
  const f = await fixture(), fetcher = vi.fn(() => { throw new Error("NO_NETWORK"); }); vi.stubGlobal("fetch", fetcher);
  const plan = await prepareLocal(f.dir, f.dir, f.env);
  expect(plan.chain_verification).toBe("not_checked"); expect(plan.services).toHaveLength(4); expect(fetcher).not.toHaveBeenCalled();
  expect(plan.services[2]!.env.AGENTTRUST_NEAR_OWNER_ID).toBe("owner.testnet");
  expect(JSON.stringify(plan.services[2]!.env)).not.toContain(b64(3));
});
it("passes bounded owner rejection references only to the web process", async () => {
  const f = await fixture(), refs = JSON.stringify([{ tx_hash: baseEncode(Buffer.alloc(32, 7)), sender_account_id: f.config.owner_id }]);
  const plan = await prepareLocal(f.dir, f.dir, { ...f.env, AGENTTRUST_NEAR_DECISION_REFS: refs });
  expect(plan.services[2]!.env.AGENTTRUST_NEAR_DECISION_REFS).toBe(refs);
  for (const index of [0, 1, 3]) expect(plan.services[index]!.env.AGENTTRUST_NEAR_DECISION_REFS).toBeUndefined();
  for (const value of ["secret", JSON.stringify([{ tx_hash: "bad", sender_account_id: f.config.owner_id }]), refs.replace(f.config.owner_id, "different.testnet"), JSON.stringify([...JSON.parse(refs), ...JSON.parse(refs)]), JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ tx_hash: baseEncode(Buffer.alloc(32, i + 1)), sender_account_id: f.config.owner_id })))]) {
    await expect(prepareLocal(f.dir, f.dir, { ...f.env, AGENTTRUST_NEAR_DECISION_REFS: value })).rejects.toThrow("INVALID_DECISION_REFERENCES");
  }
});
it.each(["provider", "mcp", "signer", "tls", "build", "dotenv"])("refuses %s drift before startup", async (kind) => {
  const f = await fixture();
  if (kind === "provider") { f.rendered.provider_a.offer.service.payout_account = "other.testnet"; await writeFile(path.join(f.dir, "provider-a.json"), JSON.stringify(f.rendered.provider_a)); }
  if (kind === "mcp") { f.rendered.mcp.owner_id = "other.testnet"; await writeFile(path.join(f.dir, "mcp.json"), JSON.stringify(f.rendered.mcp)); }
  if (kind === "signer") f.env.AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64 = b64(4);
  if (kind === "tls") await writeFile(path.join(f.dir, "key.pem"), "invalid TLS key");
  if (kind === "build") await rm(path.join(f.dir, "web/.next/BUILD_ID"));
  if (kind === "dotenv") await writeFile(path.join(f.dir, "docs-site/.env.local"), "ASK_AI_ENABLED=true\n");
  await expect(prepareLocal(f.dir, f.dir, f.env)).rejects.toThrow();
});
it("cancels during child startup and releases the port", async () => {
  const dir = await directory(), listener = net.createServer(); await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve)); const port = (listener.address() as net.AddressInfo).port; await new Promise<void>((resolve) => listener.close(() => resolve()));
  const entry = path.join(dir, "slow.mjs"); await writeFile(entry, `import http from 'node:http'; http.createServer((q,r)=>{r.statusCode=503;r.end();}).listen(${port},'127.0.0.1');`);
  const controller = new AbortController(), pending = startLocal({ providers: [], chain_verification: "not_checked", services: [{ name: "fixture", cwd: dir, args: [entry], env: {}, port, url: `http://127.0.0.1:${port}/health` }] }, controller.signal);
  const timer = setTimeout(() => controller.abort(), 300);
  try { await expect(pending).rejects.toThrow("LOCAL_STARTUP_FAILED"); await checkPorts([{ port }]); } finally { clearTimeout(timer); }
});
it("refuses a busy port without disturbing its listener", async () => {
  const server = net.createServer(); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { const port = (server.address() as net.AddressInfo).port; await expect(checkPorts([{ port }])).rejects.toThrow(`LOCAL_PORT_BUSY_${port}`); expect(server.listening).toBe(true); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
it("starts an actual local child, checks its HTTP health and releases its port on stop", async () => {
  const dir = await directory(), listener = net.createServer(); await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve)); const port = (listener.address() as net.AddressInfo).port; await new Promise<void>((resolve) => listener.close(() => resolve()));
  const entry = path.join(dir, "listener.mjs"); await writeFile(entry, `import http from 'node:http'; http.createServer((q,r)=>{r.setHeader('content-type','application/json');r.end(JSON.stringify({status:'fixture'}));}).listen(${port},'127.0.0.1');`);
  const plan: LocalPlan = { providers: [], chain_verification: "not_checked", services: [{ name: "fixture", cwd: dir, args: [entry], env: {}, port, url: `http://127.0.0.1:${port}/health`, expected: { status: "fixture" } }] };
  const running = await startLocal(plan);
  try { expect((await fetch(plan.services[0]!.url)).status).toBe(200); } finally { await running.stop(); }
  await running.closed; await checkPorts([{ port }]);
});
