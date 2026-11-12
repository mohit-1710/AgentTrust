import { pathToFileURL } from "node:url";
import { KeyPairSigner } from "near-api-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AgentTrustClient } from "../../near-sdk/src/client.js";
import { createMcpServer } from "./server.js";
import { loadMcpConfig, type McpConfig } from "./config.js";
const usage = "Usage: node dist/packages/mcp/src/run-server.js --config /absolute/mcp.json\nOptional AGENTTRUST_WORKER_PRIVATE_KEY must be the owner's restricted ed25519 function-call key, never an owner/deploy/issuer key. Omit it for read-only observation. stdout is MCP protocol only.";
export function configuredServer(config: McpConfig, secret?: string) {
  let signer: KeyPairSigner | undefined;
  if (secret !== undefined) {
    try {
      if (!secret.startsWith("ed25519:")) throw new Error();
      signer = KeyPairSigner.fromSecretKey(secret as `ed25519:${string}`);
    } catch { throw new Error("INVALID_WORKER_KEY"); }
  }
  const client = new AgentTrustClient({ network: config.network, coreAccount: config.core_account, rpcUrl: config.rpc_url, catalog: config.catalog,
    ...(signer ? { worker: { ownerId: config.owner_id, signer } } : {}),
    purchase: { ownerId: config.owner_id, sessionId: config.session_id, attemptsDirectory: config.attempts_directory,
      ...(config.credentials ? { credentials: config.credentials } : {}), ...(config.wait_timeout_ms !== undefined ? { waitTimeoutMs: config.wait_timeout_ms } : {}) },
  });
  return createMcpServer({ client, ownerId: config.owner_id, sessionId: config.session_id, paymentsEnabled: !!signer });
}
export async function runMcp(argv: readonly string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") { console.error(usage); return; }
  if (argv.length !== 2 || argv[0] !== "--config" || !argv[1]) throw new Error("MCP_USAGE: run with --help");
  const config = await loadMcpConfig(argv[1]);
  const secret = process.env.AGENTTRUST_WORKER_PRIVATE_KEY;
  delete process.env.AGENTTRUST_WORKER_PRIVATE_KEY;
  const server = configuredServer(config, secret);
  await server.connect(new StdioServerTransport());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMcp(process.argv.slice(2)).catch(() => { console.error("MCP_START_FAILED: check the public configuration and dedicated worker-key setting; no details or keys are logged."); process.exitCode = 1; });
}
