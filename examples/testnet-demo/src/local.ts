import { spawn, type ChildProcess } from "node:child_process";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSecureContext } from "node:tls";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { readProviderTls } from "../../invoice-audit/src/tls.js";
import { validateTransactionLocator } from "../../../packages/near-sdk/src/attempts.js";
import { renderPublicConfigs, validateConfig } from "./config.js";

type Environment = Record<string, string | undefined>;
type Service = { name: string; cwd: string; args: string[]; env: Environment; port: number; url: string; ca?: Buffer; expected?: object };
export interface LocalPlan { services: Service[]; providers: { file: string; config: unknown }[]; chain_verification: "not_checked" }
const allowedBase = ["PATH", "TMPDIR", "SYSTEMROOT"];
/** Never pass wallet discovery, Node injection, cloud credentials or unrelated signing roles. */
export function serviceEnvironment(role: "a" | "b" | "web" | "docs", source: Environment): Environment {
  const env: Environment = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of allowedBase) if (source[key]) env[key] = source[key];
  if (role === "a" || role === "b") env.AGENTTRUST_INVOICE_SEED_BASE64 = source[`AGENTTRUST_PROVIDER_${role.toUpperCase()}_INVOICE_SEED_BASE64`];
  if (role === "docs") env.ASK_AI_ENABLED = "false";
  return env;
}
async function json(file: string): Promise<unknown> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 64 * 1024) throw new Error("INVALID_LOCAL_CONFIG");
    const data = await handle.readFile();
    if (data.length > 64 * 1024) throw new Error("INVALID_LOCAL_CONFIG");
    return JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(data));
  } finally { await handle.close(); }
}
function invoiceKey(seed: string | undefined): string {
  if (!seed || Buffer.from(seed, "base64").length !== 32 || Buffer.from(seed, "base64").toString("base64") !== seed) throw new Error("PROVIDER_INVOICE_SEED_REQUIRED");
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed, "base64")]), type: "pkcs8", format: "der" });
  return createPublicKey(key).export({ type: "spki", format: "der" }).subarray(-32).toString("base64");
}
/** Offline configuration/build checks only. No RPC, inference, wallet or transaction operation. */
export async function prepareLocal(directory: string, root: string, source: Environment): Promise<LocalPlan> {
  if (!path.isAbsolute(directory)) throw new Error("ABSOLUTE_DEMO_DIRECTORY_REQUIRED");
  const c = validateConfig(await json(path.join(directory, "demo.json"))), rendered = renderPublicConfigs(c);
  if (!isDeepStrictEqual(await json(path.join(directory, "mcp.json")), rendered.mcp)) throw new Error("MCP_CONFIG_DRIFT");
  const services: Service[] = [], providers: LocalPlan["providers"] = [];
  const providerEntry = path.join(root, "dist/examples/invoice-audit/src/run-server.js");
  await access(providerEntry);
  for (const label of ["a", "b"] as const) {
    const file = path.join(directory, `provider-${label}.json`), raw = await json(file);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_PROVIDER_CONFIG");
    const actual = raw as Record<string, unknown>, expected = rendered[`provider_${label}`];
    if (!isDeepStrictEqual({ ...actual, tls: expected.tls }, expected)) throw new Error("PROVIDER_CONFIG_DRIFT");
    const env = serviceEnvironment(label, source);
    if (invoiceKey(env.AGENTTRUST_INVOICE_SEED_BASE64) !== c.providers[label].invoice_key) throw new Error("PROVIDER_SIGNER_MISMATCH");
    const tls = await readProviderTls(actual.tls, expected.offer.origin, expected.port); createSecureContext(tls);
    providers.push({ file, config: actual });
    services.push({ name: `provider-${label}`, cwd: root, args: [providerEntry, "--config", file], env, port: expected.port, url: `${expected.offer.origin}/health`, ca: tls.cert,
      expected: { status: "configured", network: c.network, core_account: c.core_account, service_id: expected.offer.service.service_id, service_version: 1, endpoint_hash: expected.offer.service.endpoint_hash, chain_verification: "not_checked" } });
  }
  for (const [name, folder, port] of [["web", "web", 3000], ["docs", "docs-site", 3001]] as const) {
    const cwd = path.join(root, folder), entry = path.join(cwd, "node_modules/next/dist/bin/next");
    await access(path.join(cwd, ".next/BUILD_ID")); await access(entry);
    // Next automatically reads these files even with an isolated subprocess environment.
    for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
      try { await lstat(path.join(cwd, file)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
      throw new Error("SURFACE_ENV_FILE_PRESENT");
    }
    const env = serviceEnvironment(name, source);
    if (name === "web") {
      Object.assign(env, { AGENTTRUST_NEAR_RPC_URL: c.rpc_url, AGENTTRUST_NEAR_CORE_ACCOUNT: c.core_account, AGENTTRUST_NEAR_OWNER_ID: c.owner_id });
      const raw = source.AGENTTRUST_NEAR_DECISION_REFS;
      if (raw) {
        try {
          if (raw.length > 4096) throw new Error();
          const refs: unknown = JSON.parse(raw);
          if (!Array.isArray(refs) || refs.length > 8) throw new Error();
          const hashes = new Set<string>();
          for (const ref of refs) { validateTransactionLocator(ref, c.owner_id); if (hashes.has(ref.tx_hash)) throw new Error(); hashes.add(ref.tx_hash); }
          env.AGENTTRUST_NEAR_DECISION_REFS = JSON.stringify(refs);
        } catch { throw new Error("INVALID_DECISION_REFERENCES"); }
      }
    }
    services.push({ name, cwd, args: [entry, "start", "--hostname", "127.0.0.1", "--port", String(port)], env, port, url: `http://127.0.0.1:${port}${name === "docs" ? "/api/ask" : "/"}`, ...(name === "docs" ? { expected: { available: false } } : {}) });
  }
  if (new Set(services.map((s) => s.port)).size !== services.length) throw new Error("DISTINCT_LOCAL_PORTS_REQUIRED");
  return { services, providers, chain_verification: "not_checked" };
}
export async function checkPorts(services: Pick<Service, "port">[]): Promise<void> {
  for (const { port } of services) await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`LOCAL_PORT_BUSY_${port}`)));
    server.listen(port, "127.0.0.1", () => server.close((error) => error ? reject(error) : resolve()));
  });
}
async function healthy(service: Service): Promise<boolean> {
  return new Promise((resolve) => {
    const url = new URL(service.url), client = url.protocol === "https:" ? https : http;
    // Force loopback IPv4 while preserving the certificate hostname; never follow redirects.
    const req = client.get(url, { family: 4, ...(service.ca ? { ca: service.ca } : {}), timeout: 1500 }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { if (body.length + chunk.length > 1024 * 1024) { res.destroy(); resolve(false); } else body += chunk.toString(); });
      res.on("error", () => resolve(false));
      res.on("end", () => { try { resolve(res.statusCode === 200 && (!service.expected || isDeepStrictEqual(JSON.parse(body), service.expected))); } catch { resolve(false); } });
    });
    req.on("timeout", () => req.destroy()); req.on("error", () => resolve(false));
  });
}
export async function startLocal(plan: LocalPlan, signal?: AbortSignal): Promise<{ stop: () => Promise<void>; closed: Promise<void> }> {
  if (signal?.aborted) throw new Error("LOCAL_STARTUP_CANCELLED");
  await checkPorts(plan.services);
  const directory = await mkdtemp(path.join(tmpdir(), "agenttrust-local-")), children: ChildProcess[] = [];
  let stopping = false, close!: () => void;
  const closed = new Promise<void>((resolve) => { close = resolve; });
  async function stop() {
    if (stopping) return closed; stopping = true;
    await Promise.all(children.map((child) => new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
      child.once("close", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM");
    })));
    signal?.removeEventListener("abort", cancel);
    await rm(directory, { recursive: true, force: true }); close();
  }
  const cancel = () => { void stop(); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (signal?.aborted) throw new Error("LOCAL_STARTUP_CANCELLED");
    const snapshots = new Map<string, string>();
    for (const [i, provider] of plan.providers.entries()) {
      const file = path.join(directory, `provider-${i}.json`); await writeFile(file, JSON.stringify(provider.config), { mode: 0o600, flag: "wx" }); snapshots.set(provider.file, file);
    }
    for (const service of plan.services) {
      if (stopping) throw new Error("LOCAL_STARTUP_CANCELLED");
      const child = spawn(process.execPath, service.args.map((arg) => snapshots.get(arg) ?? arg), { cwd: service.cwd, env: service.env, stdio: "ignore" });
      children.push(child); child.once("error", () => { void stop(); }); child.once("exit", () => { void stop(); });
    }
    const deadline = Date.now() + 30_000;
    while (!stopping && Date.now() < deadline) {
      if ((await Promise.all(plan.services.map(healthy))).every(Boolean) && !stopping) return { stop, closed };
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("LOCAL_STARTUP_FAILED");
  } catch (error) { await stop(); throw error; }
}
export function localArguments(argv: string[]) {
  if (argv.length !== 3 || !["--check", "--start"].includes(argv[0]!) || argv[1] !== "--directory" || !path.isAbsolute(argv[2]!)) throw new Error("LOCAL_ARGUMENTS_REQUIRED");
  return { start: argv[0] === "--start", directory: argv[2]! };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 2 || process.argv.slice(2).join(" ") === "--help") {
    console.log("local.js --check|--start --directory /absolute/demo-directory\nChecks local configuration, build artifacts and TLS. --start runs two providers, web and docs until Ctrl-C. No browser, chain setup, signing, model request or MCP child is started. Provider invoice seeds must be supplied per role. Chain verification remains not_checked.");
  } else try {
    const args = localArguments(process.argv.slice(2)), root = fileURLToPath(new URL("../../../../", import.meta.url));
    const plan = await prepareLocal(args.directory, root, process.env);
    if (!args.start) { await checkPorts(plan.services); console.log(JSON.stringify({ status: "local_preflight_passed", chain_verification: plan.chain_verification })); }
    else {
      const controller = new AbortController(), stop = () => controller.abort();
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      try {
        const running = await startLocal(plan, controller.signal);
        console.log(JSON.stringify({ status: "local_listeners_ready", chain_verification: plan.chain_verification, urls: plan.services.map((s) => s.url) }));
        await running.closed; if (!controller.signal.aborted) process.exitCode = 1;
      } finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
    }
  } catch (error) { console.error(`LOCAL_DEMO_REFUSED: ${error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "CHECK_CONFIG_BUILDS_TLS_AND_PORTS"}`); process.exitCode = 1; }
}
