import type { SignedInvoiceV1 } from "./types.js";
import type { CredentialRef, TransactionLocator } from "./views.js";
export const PAID_PROTOCOL = "agenttrust-http402-v1";
export const MAX_HTTP_BODY = 512 * 1024;
export const MAX_HTTP_RESPONSE = 8 * 1024 * 1024;
export interface QuoteContext {
  owner_id: string; session_id: string; payment_id: string;
  policy_revision: number; profile_id: string; profile_revision: number;
}
export interface QuoteRequest { mode: "quote"; csv_utf8: string; context: QuoteContext }
export interface RedemptionRequest {
  mode: "redeem"; csv_utf8: string; quote: SignedInvoiceV1;
  credential: CredentialRef | null; transaction: TransactionLocator;
}
export function exactFields(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}
/** Bounded decoding preserves raw CSV string bytes; callers reject redirects separately. */
export async function readJson(body: ReadableStream<Uint8Array> | null, limit: number): Promise<unknown> {
  if (!body) throw new Error("EMPTY_BODY");
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > limit) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(Buffer.concat(chunks)));
}
