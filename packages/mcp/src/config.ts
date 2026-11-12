import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import { AgentTrustClient } from "../../near-sdk/src/client.js";
import { ServiceDirectory } from "../../near-sdk/src/directory.js";
import { accountId, credentialRef, hash32 } from "./schemas.js";
const configSchema = z.object({
  schema_version: z.literal(1), network: z.literal("near:testnet"), core_account: accountId,
  rpc_url: z.string().max(2048), owner_id: accountId, session_id: hash32,
  attempts_directory: z.string().max(4096).refine(isAbsolute),
  catalog: z.array(z.object({ service_id: accountId, service_version: z.number().int().min(1).max(0xffffffff), origin: z.string().max(2048) }).strict()).max(128),
  credentials: z.array(z.object({ service_id: accountId, service_version: z.number().int().min(1).max(0xffffffff), credential: credentialRef }).strict()).max(128).optional(),
  wait_timeout_ms: z.number().int().min(0).max(300_000).optional(),
}).strict();
export type McpConfig = z.infer<typeof configSchema>;
export function parseMcpConfig(value: unknown): McpConfig {
  try {
    const config = configSchema.parse(value);
    new ServiceDirectory(config.catalog); // Canonical HTTPS and duplicate version checks.
    new AgentTrustClient({ network: config.network, coreAccount: config.core_account, rpcUrl: config.rpc_url }); // Pure URL/domain validation; no request.
    const seen = new Set<string>();
    for (const entry of config.credentials ?? []) {
      const key = `${entry.service_id}/${entry.service_version}`;
      if (seen.has(key)) throw new Error(); seen.add(key);
    }
    return config;
  } catch { throw new Error("INVALID_MCP_CONFIG"); }
}
export async function loadMcpConfig(path: string): Promise<McpConfig> {
  if (!isAbsolute(path)) throw new Error("INVALID_MCP_CONFIG_PATH");
  try {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 64 * 1024) throw new Error();
      const bytes = await file.readFile();
      if (bytes.length > 64 * 1024) throw new Error();
      return parseMcpConfig(JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)));
    } finally { await file.close(); }
  } catch { throw new Error("INVALID_MCP_CONFIG"); }
}
