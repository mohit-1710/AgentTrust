import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { baseEncode, KeyPairSigner } from "near-api-js";
import { afterEach, expect, it, vi } from "vitest";
import { AgentTrustClient } from "../../../packages/near-sdk/src/client.js";
import { loadBuyerConfig } from "../../buyer-agent/src/config.js";
import { loadConformanceSuite } from "../../invoice-audit/src/conformance.js";
import { renderPublicConfigs, type DemoConfig } from "../src/config.js";
import { buyerConfigArguments, prepareBuyerConfig } from "../src/buyer-config.js";

const directories: string[] = [];
const hash = (n: number) => Buffer.alloc(32, n).toString("base64");
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "agenttrust-buyer-config-test-")); directories.push(dir);
  const provider = (label: string, port: number, key: number) => ({ service_id: `${label}.testnet`, payout_account: `${label}-pay.testnet`, invoice_key: hash(key), origin: `https://localhost:${port}`, amount_yocto: "2000000000000000000000", port });
  const config: DemoConfig = { schema_version: 1, network: "near:testnet", rpc_url: "https://rpc.invalid", core_account: "core.testnet", expected_wasm_sha256: "ab".repeat(32), owner_id: "owner.testnet", issuer_id: "issuer.testnet", worker_public_key: `ed25519:${baseEncode(Buffer.alloc(32, 1))}`, session_id: hash(1), profile_id: "invoice-audit", session_expires_at_ns: "2000000000000000000", credential_id: hash(2), credential_expires_at_ns: "2000000000000000000", attempts_directory: path.join(dir, "attempts"), rotated_payout_account: "rotated.testnet", providers: { a: provider("alpha", 4041, 3), b: provider("beta", 4042, 4) }, payment_ids: { missing: hash(10), paid: hash(11), revoked: hash(12), identity: hash(13) } };
  const mcp = renderPublicConfigs(config).mcp;
  await writeFile(path.join(dir, "demo.json"), JSON.stringify(config));
  await writeFile(path.join(dir, "mcp.json"), JSON.stringify(mcp));
  return { dir, config, mcp };
}
const args = (dir: string, mode = "scripted") => ["--directory", dir, "--mode", mode];

it("accepts only the explicit mode-specific argument shapes", () => {
  expect(buyerConfigArguments(args("/prepared"))).toEqual({ directory: "/prepared", mode: "scripted" });
  expect(buyerConfigArguments([...args("/prepared", "near-ai"), "--model", "provider/model.v1"])).toEqual({ directory: "/prepared", mode: "near-ai", model: "provider/model.v1" });
  for (const invalid of [[], args("relative"), args("/prepared", "unknown"), args("/prepared", "near-ai"), [...args("/prepared"), "--model", "model"], [...args("/prepared", "near-ai"), "--model", ""], [...args("/prepared", "near-ai"), "--model", "model", "extra"], ["--mode", "scripted", "--directory", "/prepared"], [...args("/prepared"), "--execute"]]) expect(() => buyerConfigArguments(invalid)).toThrow("BUYER_CONFIG_ARGUMENTS_REQUIRED");
});

it("writes the exact committed CSV, prepared service candidates and MCP path with private permissions", async () => {
  const f = await fixture(), before = await readFile(path.join(f.dir, "mcp.json"), "utf8");
  const file = await prepareBuyerConfig(args(f.dir)), config = await loadBuyerConfig(file);
  expect(file).toBe(path.join(f.dir, "buyer-scripted.json"));
  expect(config.csv_utf8).toBe(loadConformanceSuite().fixtures.find((entry) => entry.fixture_id === "mixed-validity")!.csv_utf8);
  expect(config.mcp_config_file).toBe(path.join(f.dir, "mcp.json"));
  expect(config.job_directory).toBe(path.join(f.dir, "buyer-jobs"));
  expect(config.candidates.map((c) => c.service_id)).toEqual([f.config.providers.a.service_id, f.config.providers.b.service_id]);
  expect(config).toMatchObject({ mode: "scripted", max_steps: 8, max_completion_tokens: 1024 });
  expect(config).not.toHaveProperty("model");
  expect((await lstat(file)).mode & 0o777).toBe(0o600);
  expect(await readFile(path.join(f.dir, "mcp.json"), "utf8")).toBe(before);
  await expect(lstat(config.job_directory)).rejects.toMatchObject({ code: "ENOENT" });
});

it("gives scripted and model runs separate files and fresh IDs distinct from every T18 payment", async () => {
  const f = await fixture();
  const scripted = await loadBuyerConfig(await prepareBuyerConfig(args(f.dir)));
  const nearAi = await loadBuyerConfig(await prepareBuyerConfig([...args(f.dir, "near-ai"), "--model", "test/model"]));
  expect(nearAi).toMatchObject({ mode: "near-ai", model: "test/model" });
  const ids = [scripted, nearAi].flatMap((config) => [config.job_id, ...config.candidates.map((c) => c.payment_id)]);
  expect(new Set(ids).size).toBe(6);
  for (const id of ids) {
    expect(Buffer.from(id, "base64").length).toBe(32); expect(Buffer.from(id, "base64").toString("base64")).toBe(id);
    expect(Object.values(f.config.payment_ids)).not.toContain(id);
  }
});

it("never replaces an existing output, including a symlink, or changes its IDs", async () => {
  const f = await fixture(), file = await prepareBuyerConfig(args(f.dir)), bytes = await readFile(file);
  await expect(prepareBuyerConfig(args(f.dir))).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(file)).toEqual(bytes);
  const target = path.join(f.dir, "protected.json"); await writeFile(target, "original");
  await symlink(target, path.join(f.dir, "buyer-near-ai.json"));
  await expect(prepareBuyerConfig([...args(f.dir, "near-ai"), "--model", "test/model"])).rejects.toThrow();
  expect(await readFile(target, "utf8")).toBe("original");
});

it("publishes only one configuration when two preparations race for the same mode", async () => {
  const f = await fixture(), results = await Promise.allSettled([prepareBuyerConfig(args(f.dir)), prepareBuyerConfig(args(f.dir))]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  const winning = results.find((r) => r.status === "fulfilled")! as PromiseFulfilledResult<string>;
  expect((await loadBuyerConfig(winning.value)).mode).toBe("scripted");
});

it.each(["owner", "session", "catalog", "credential", "extra"])("refuses %s drift in the MCP config before creating a buyer file", async (kind) => {
  const f = await fixture();
  if (kind === "owner") f.mcp.owner_id = "other.testnet";
  if (kind === "session") f.mcp.session_id = hash(99);
  if (kind === "catalog") f.mcp.catalog[0]!.origin = "https://localhost:4444";
  if (kind === "credential") f.mcp.credentials[0]!.credential.revision = 2;
  await writeFile(path.join(f.dir, "mcp.json"), JSON.stringify({ ...f.mcp, ...(kind === "extra" ? { unexpected: true } : {}) }));
  await expect(prepareBuyerConfig(args(f.dir))).rejects.toThrow();
  await expect(lstat(path.join(f.dir, "buyer-scripted.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("validates the demo and resulting model config without writing invalid output", async () => {
  const f = await fixture();
  await expect(prepareBuyerConfig([...args(f.dir, "near-ai"), "--model", "invalid model"])).rejects.toThrow();
  await expect(lstat(path.join(f.dir, "buyer-near-ai.json"))).rejects.toMatchObject({ code: "ENOENT" });
  await writeFile(path.join(f.dir, "demo.json"), JSON.stringify({ ...f.config, unknown: true }));
  await expect(prepareBuyerConfig(args(f.dir))).rejects.toThrow();
  await expect(lstat(path.join(f.dir, "buyer-scripted.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("prepares both modes without network, signing or reading role secrets", async () => {
  const f = await fixture(), fetcher = vi.fn(() => { throw new Error("NO_NETWORK"); }); vi.stubGlobal("fetch", fetcher);
  const signing = vi.spyOn(KeyPairSigner, "fromSecretKey").mockImplementation(() => { throw new Error("NO_SIGNER"); });
  const payment = vi.spyOn(AgentTrustClient.prototype, "executePayment").mockImplementation(() => { throw new Error("NO_PAYMENT"); });
  for (const name of ["AGENTTRUST_SETUP_PRIVATE_KEY", "AGENTTRUST_WORKER_PRIVATE_KEY", "AGENTTRUST_INVOICE_SEED_BASE64", "NEAR_AI_API_KEY"]) vi.stubEnv(name, "SECRET_SENTINEL_NOT_READ");
  for (const argv of [args(f.dir), [...args(f.dir, "near-ai"), "--model", "offline/model"]]) expect(await readFile(await prepareBuyerConfig(argv), "utf8")).not.toContain("SECRET_SENTINEL_NOT_READ");
  expect(fetcher).not.toHaveBeenCalled(); expect(signing).not.toHaveBeenCalled(); expect(payment).not.toHaveBeenCalled();
});
