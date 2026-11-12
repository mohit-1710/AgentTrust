import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMcpConfig, parseMcpConfig } from "../src/config.js";
import { configuredServer, runMcp } from "../src/run-server.js";
const paths: string[] = [];
afterEach(async () => { await Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true, force: true }))); vi.restoreAllMocks(); });
const config = { schema_version: 1, network: "near:testnet", core_account: "core.testnet", rpc_url: "https://rpc.example", owner_id: "owner.testnet", session_id: Buffer.alloc(32, 1).toString("base64"), attempts_directory: "/tmp/agenttrust-test-only", catalog: [] };
async function file(content: string) { const dir = await realpath(await mkdtemp(join(tmpdir(), "agenttrust-mcp-config-"))); paths.push(dir); const path = join(dir, "config.json"); await writeFile(path, content); return { dir, path }; }
describe("MCP startup uses only public operator configuration", () => {
  it("loads a bounded absolute ordinary JSON config without creating a journal", async () => { const f = await file(JSON.stringify(config)); expect(await loadMcpConfig(f.path)).toEqual(config); });
  it("rejects symlink, relative path, malformed and oversized config without exposing contents", async () => {
    const f = await file('private-secret-not-json'); const link = join(f.dir, "linked.json"); await symlink(f.path, link);
    for (const path of [f.path, link]) await expect(loadMcpConfig(path)).rejects.toThrow("INVALID_MCP_CONFIG");
    await expect(loadMcpConfig("relative.json")).rejects.toThrow("INVALID_MCP_CONFIG_PATH");
    await writeFile(f.path, "x".repeat(65537)); await expect(loadMcpConfig(f.path)).rejects.toThrow("INVALID_MCP_CONFIG");
  });
  it("rejects duplicate credentials and catalog versions", () => {
    const entry = { service_id: "service.testnet", service_version: 1, origin: "https://audit.example" };
    const credential = { service_id: entry.service_id, service_version: 1, credential: { issuer_id: "issuer.testnet", credential_id: Buffer.alloc(32).toString("base64"), revision: 1 } };
    expect(() => parseMcpConfig({ ...config, catalog: [entry, entry] })).toThrow("INVALID_MCP_CONFIG");
    expect(() => parseMcpConfig({ ...config, credentials: [credential, credential] })).toThrow("INVALID_MCP_CONFIG");
  });
  it("rejects invalid worker secrets without echoing them", () => {
    for (const key of ["owner-secret-sensitive", "ed25519:invalid-secret-sensitive", "secp256k1:invalid-sensitive"]) expect(() => configuredServer(parseMcpConfig(config), key)).toThrow("INVALID_WORKER_KEY");
  });
  it("supports a no-key server and explicit help without writing protocol noise to stdout", async () => {
    const server = configuredServer(parseMcpConfig(config)); await server.close();
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {}), stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    await runMcp(["--help"]); expect(stderr).toHaveBeenCalledWith(expect.stringContaining("restricted ed25519")); expect(stdout).not.toHaveBeenCalled();
    await expect(runMcp([])).rejects.toThrow("MCP_USAGE");
  });
});
