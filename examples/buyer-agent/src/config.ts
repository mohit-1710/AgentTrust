import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import { accountId, hash32, tools } from "../../../packages/mcp/src/schemas.js";
import type { McpConfig } from "../../../packages/mcp/src/config.js";
import { readAuditCsv } from "../../invoice-audit/src/audit.js";
export const candidateSchema = z.object({ service_id: accountId, payment_id: hash32 }).strict();
const schema = z.object({ schema_version: z.literal(1), job_id: hash32, mcp_config_file: z.string().max(4096).refine(isAbsolute), job_directory: z.string().max(4096).refine(isAbsolute), csv_utf8: tools.pay_service.shape.csvUtf8, candidates: z.array(candidateSchema).min(1).max(2), mode: z.enum(["scripted", "near-ai", "local-model"]), model: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._/-]+(?::[a-zA-Z0-9._-]+)?$/).optional(), max_steps: z.number().int().min(1).max(12), max_completion_tokens: z.number().int().min(1).max(4096) }).strict();
export type BuyerConfig = z.infer<typeof schema>;
export type Candidate = z.infer<typeof candidateSchema>;
export function parseBuyerConfig(value: unknown): BuyerConfig {
  try {
    const config = schema.parse(value); readAuditCsv(config.csv_utf8);
    if ((config.mode !== "scripted") !== (config.model !== undefined) || config.mode === "near-ai" && config.model?.includes(":") || new Set(config.candidates.map((c) => c.service_id)).size !== config.candidates.length || new Set(config.candidates.map((c) => c.payment_id)).size !== config.candidates.length) throw new Error();
    return config;
  } catch { throw new Error("INVALID_BUYER_CONFIG"); }
}
export async function loadBuyerConfig(path: string): Promise<BuyerConfig> {
  try {
    if (!isAbsolute(path)) throw new Error();
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { const stat = await file.stat(); if (!stat.isFile() || stat.size > 512 * 1024) throw new Error(); const bytes = await file.readFile(); if (bytes.length > 512 * 1024) throw new Error(); return parseBuyerConfig(JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes))); }
    finally { await file.close(); }
  } catch { throw new Error("INVALID_BUYER_CONFIG"); }
}
export function bindConfig(config: BuyerConfig, mcp: McpConfig): void {
  if (config.candidates.some((c) => !mcp.catalog.some((entry) => entry.service_id === c.service_id))) throw new Error("BUYER_CATALOG_MISMATCH");
}
