/** Offline public configuration preparation only. No key, model or chain operation. */
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { loadMcpConfig } from "../../../packages/mcp/src/config.js";
import { bindConfig, parseBuyerConfig } from "../../buyer-agent/src/config.js";
import { loadConformanceSuite } from "../../invoice-audit/src/conformance.js";
import { readConfig, renderPublicConfigs } from "./config.js";

export function buyerConfigArguments(argv: readonly string[]): { directory: string; mode: "scripted" | "near-ai"; model?: string } {
  const directory = argv[1], mode = argv[3];
  if (argv[0] !== "--directory" || !directory || !path.isAbsolute(directory) || argv[2] !== "--mode" ||
      mode !== "scripted" && mode !== "near-ai" ||
      mode === "scripted" && argv.length !== 4 ||
      mode === "near-ai" && (argv.length !== 6 || argv[4] !== "--model" || !argv[5])) throw new Error("BUYER_CONFIG_ARGUMENTS_REQUIRED");
  return { directory, mode, ...(mode === "near-ai" ? { model: argv[5]! } : {}) };
}
export async function prepareBuyerConfig(argv: readonly string[]): Promise<string> {
  const args = buyerConfigArguments(argv), directory = path.resolve(args.directory);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("PREPARED_DEMO_DIRECTORY_REQUIRED");
  const demo = await readConfig(path.join(directory, "demo.json")), mcpPath = path.join(directory, "mcp.json");
  const mcp = await loadMcpConfig(mcpPath);
  if (!isDeepStrictEqual(mcp, renderPublicConfigs(demo).mcp)) throw new Error("MCP_CONFIG_DRIFT");
  const reserved = new Set([demo.session_id, demo.credential_id, ...Object.values(demo.payment_ids)]);
  const freshId = () => {
    let id: string;
    do { id = randomBytes(32).toString("base64"); } while (reserved.has(id));
    reserved.add(id); return id;
  };
  const config = parseBuyerConfig({ schema_version: 1, job_id: freshId(), mcp_config_file: mcpPath,
    job_directory: path.join(directory, "buyer-jobs"),
    csv_utf8: loadConformanceSuite().fixtures.find((entry) => entry.fixture_id === "mixed-validity")!.csv_utf8,
    candidates: [demo.providers.a, demo.providers.b].map((provider) => ({ service_id: provider.service_id, payment_id: freshId() })),
    mode: args.mode, ...(args.model ? { model: args.model } : {}), max_steps: 8, max_completion_tokens: 1024 });
  bindConfig(config, mcp);
  const file = path.join(directory, `buyer-${args.mode}.json`);
  const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(config, null, 2) + "\n"); await handle.sync(); }
  finally { await handle.close(); }
  const parent = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await parent.sync(); } finally { await parent.close(); }
  return file;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--help") console.log("buyer-config.js --directory /absolute/prepared-demo --mode scripted|near-ai [--model MODEL_ID]\n--model is required only for near-ai. Reads demo.json and mcp.json; exclusively creates buyer-scripted.json or buyer-near-ai.json with fresh IDs and the committed mixed-validity CSV. Offline preparation only: no keys, network, model readiness check, signing or execution.");
  else prepareBuyerConfig(argv).then((file) => { console.log(JSON.stringify({ status: "buyer_config_prepared", file, execution: "not_started" })); }).catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException)?.code === "EEXIST" ? "BUYER_CONFIG_ALREADY_EXISTS_KEEP_ORIGINAL_IDS" : error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "CHECK_ARGUMENTS_AND_PREPARED_PUBLIC_CONFIG";
    console.error(`BUYER_CONFIG_REFUSED: ${code}`); process.exitCode = 1;
  });
}
