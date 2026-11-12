import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpConfig } from "../../../packages/mcp/src/config.js";
import { bindConfig, loadBuyerConfig } from "./config.js";
import { checkModel, nearAiDriver, scriptedDriver } from "./model.js";
import { runBuyer } from "./loop.js";
export function workerEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return { PATH: env.PATH ?? "", ...(env.AGENTTRUST_WORKER_PRIVATE_KEY ? { AGENTTRUST_WORKER_PRIVATE_KEY: env.AGENTTRUST_WORKER_PRIVATE_KEY } : {}), ...(env.NODE_EXTRA_CA_CERTS ? { NODE_EXTRA_CA_CERTS: env.NODE_EXTRA_CA_CERTS } : {}) };
}
const help = "Usage: node dist/examples/buyer-agent/src/run.js --config /absolute/private/buyer.json --execute\n--execute explicitly permits configured native payment calls; near-ai mode also makes billable model requests (NEAR_AI_API_KEY). Scripted mode is a deterministic harness, not autonomous-agent evidence. Use synthetic demo CSV only. Worker key goes only to the local MCP child. Keep the same job directory/config/IDs for recovery. --help performs no network calls.";
export async function runCli(argv: readonly string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") { console.error(help); return; }
  if (argv.length !== 3 || argv[0] !== "--config" || !argv[1] || argv[2] !== "--execute") throw new Error("EXPLICIT_EXECUTION_REQUIRED");
  const config = await loadBuyerConfig(argv[1]), mcp = await loadMcpConfig(config.mcp_config_file); bindConfig(config, mcp);
  const childEnv = workerEnvironment(process.env), apiKey = process.env.NEAR_AI_API_KEY;
  delete process.env.AGENTTRUST_WORKER_PRIVATE_KEY; delete process.env.NEAR_AI_API_KEY;
  if (!childEnv.AGENTTRUST_WORKER_PRIVATE_KEY) throw new Error("WORKER_KEY_REQUIRED");
  if (config.mode === "near-ai") { if (!apiKey) throw new Error("MODEL_KEY_REQUIRED"); await checkModel(config.model!); }
  const driver = config.mode === "near-ai" ? nearAiDriver(config, apiKey!) : scriptedDriver(config);
  const snapshotDirectory = await mkdtemp(join(tmpdir(), "agenttrust-buyer-config-"));
  const snapshotPath = join(snapshotDirectory, "mcp.json");
  await writeFile(snapshotPath, JSON.stringify(mcp), { mode: 0o600 });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../../../packages/mcp/src/run-server.js", import.meta.url)), "--config", snapshotPath], env: childEnv, stderr: "pipe" });
  transport.stderr?.on("data", () => {});
  const client = new Client({ name: "agenttrust-buyer", version: "0.1.0" });
  let gitCommit = "unavailable";
  try { gitCommit = execFileSync("git", ["-C", fileURLToPath(new URL("../../../../", import.meta.url)), "rev-parse", "HEAD"], { env: { PATH: process.env.PATH ?? "" }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* Explicitly unknown provenance. */ }
  try {
    await client.connect(transport, { timeout: 10_000 });
    const result = await runBuyer({ config, mcp, driver, gitCommit, client: { listTools: () => client.listTools({}, { timeout: 10_000 }), callTool: (args) => client.callTool(args, undefined, { timeout: 350_000 }) } });
    console.log(JSON.stringify({ mode: config.mode, evidence: config.mode === "scripted" ? "scripted_harness_not_autonomous" : result.model_responses > 0 ? "near_ai_model_tool_loop" : "no_model_response_this_run", ...result }));
    if (result.kind !== "paid") process.exitCode = 2;
  } finally { await client.close(); await rm(snapshotDirectory, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli(process.argv.slice(2)).catch(() => { console.error("BUYER_STOPPED: inspect the configured job and original payment IDs; no raw error or key is logged."); process.exitCode = 1; });
