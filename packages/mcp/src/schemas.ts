import { z } from "zod";
import { validateAccountId, validateHash32, validateProfileId, validateU64, validateU128 } from "../../near-sdk/src/codec.js";
const valid = (check: (value: string) => unknown) => (value: string): boolean => { try { check(value); return true; } catch { return false; } };
export const accountId = z.string().min(2).max(64).refine(valid(validateAccountId), "Invalid native account ID");
export const hash32 = z.string().length(44).refine(valid(validateHash32), "Invalid canonical Hash32");
const u64 = z.string().max(20).refine(valid(validateU64), "Invalid U64 decimal string");
const u128 = z.string().max(39).refine(valid(validateU128), "Invalid U128 decimal string");
const u32 = z.number().int().min(0).max(0xffffffff);
export const credentialRef = z.object({ issuer_id: accountId, credential_id: hash32, revision: u32.min(1) }).strict();
const invoice = z.object({
  schema_version: z.literal(1), network: z.literal("near:testnet"), core_account: accountId, owner_id: accountId,
  session_id: hash32, payment_id: hash32, policy_revision: u32,
  profile_id: z.string().max(64).refine(valid(validateProfileId), "Invalid bounded profile ID"), profile_revision: u32,
  service_id: accountId, service_version: u32.min(1), payout_account: accountId,
  endpoint_hash: hash32, request_hash: hash32, asset: z.literal("NEAR"), amount_yocto: u128,
  issued_at_ns: u64, expires_at_ns: u64,
}).strict();
export const signedQuote = z.object({ invoice, signature: z.string().length(88).refine((value) => Buffer.from(value, "base64").length === 64 && Buffer.from(value, "base64").toString("base64") === value, "Invalid canonical signature") }).strict();
export const tools = {
  list_services: z.object({ cursor: u64.nullable().optional(), limit: z.number().int().min(1).max(20).optional() }).strict(),
  get_service: z.object({ serviceId: accountId }).strict(),
  get_policy: z.object({}).strict(),
  preview_payment: z.object({ quote: signedQuote, credential: credentialRef.nullable() }).strict(),
  pay_service: z.object({ serviceId: accountId, csvUtf8: z.string().max(65536).refine((value) => Buffer.byteLength(value, "utf8") <= 65536 && new TextDecoder("utf8", { fatal: true, ignoreBOM: true }).decode(Buffer.from(value, "utf8")) === value, "CSV must contain at most 64 KiB of valid UTF-8"), paymentId: hash32 }).strict(),
  get_payment: z.object({ paymentId: hash32 }).strict(),
};
