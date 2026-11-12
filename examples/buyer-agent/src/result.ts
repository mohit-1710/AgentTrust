import { ServiceDirectory } from "../../../packages/near-sdk/src/directory.js";
import type { BuyerConfig, Candidate } from "./config.js";
import type { McpConfig } from "../../../packages/mcp/src/config.js";
import type { PaidAuditResult } from "../../../packages/near-sdk/src/pay-service.js";
import { exactFields } from "../../../packages/near-sdk/src/paid-protocol.js";
import { validateCredentialRef, validateTransactionLocator } from "../../../packages/near-sdk/src/attempts.js";
import { observePayment, validateDecision, validatePayment } from "../../../packages/near-sdk/src/finality.js";
import { requestHash } from "../../../packages/near-sdk/src/codec.js";
import { checkAuditOutput } from "../../invoice-audit/src/check-output.js";
export type Definitive = Extract<PaidAuditResult, { kind: "paid" | "denied" | "failed" }>;
export function definitive(value: unknown, config: BuyerConfig, mcp: McpConfig, candidate: Candidate): Definitive {
  if (!value || typeof value !== "object" || !("kind" in value)) throw new Error("UNRESOLVED_TOOL_RESULT");
  const v = value as Definitive;
  if (v.kind === "denied") {
    const fields = v.origin === "preview" ? ["kind", "origin", "payment_id", "decision"] : v.origin === "recorded_replay" ? ["kind", "origin", "payment_id", "decision", "original_origin"] : ["kind", "origin", "payment_id", "decision", "transaction", "receipt_ids"];
    if (!exactFields(v, fields) || v.payment_id !== candidate.payment_id || !["preview", "recorded_replay", "executed_rejection"].includes(v.origin) || v.origin === "recorded_replay" && v.original_origin !== "preview" || checkedDecision(v.decision).kind === "allow") throw new Error("INVALID_DENIAL");
    if (v.origin === "executed_rejection") { validateTransactionLocator(v.transaction, mcp.owner_id); receipts(v.receipt_ids); }
    return v;
  }
  if (v.kind !== "paid" && v.kind !== "failed") throw new Error("UNRESOLVED_TOOL_RESULT");
  if (!exactFields(v, v.kind === "paid" ? ["kind", "payment", "block", "transaction", "receipt_ids", "report", "output_check"] : ["kind", "payment", "block", "transaction"])) throw new Error("INVALID_PAYMENT_RESULT");
  const payment = checkedPayment(v.payment, mcp.network, mcp.core_account, mcp.owner_id, candidate.payment_id);
  if (!payment || payment.invoice.service_id !== candidate.service_id || payment.invoice.session_id !== mcp.session_id || payment.invoice.request_hash !== requestHash(config.csv_utf8) || payment.state !== (v.kind === "paid" ? "settled" : "failed")) throw new Error("PAYMENT_CONTEXT_MISMATCH");
  new ServiceDirectory(mcp.catalog).forSettledInvoice(payment.invoice);
  observePayment({ value: payment, block: blockSchema.parse(v.block) }, mcp.owner_id, candidate.payment_id); validateTransactionLocator(v.transaction, mcp.owner_id);
  if (v.kind === "paid") {
    receipts(v.receipt_ids);
    if (!exactFields(v.output_check, ["ok"]) || v.output_check.ok !== true || !checkAuditOutput(config.csv_utf8, v.report).ok) throw new Error("OUTPUT_CHECK_FAILED");
  }
  return v;
}
function receipts(value: unknown): void { if (!Array.isArray(value) || !value.length || value.length > 128 || value.some((id) => typeof id !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id))) throw new Error("INVALID_RECEIPTS"); }

/** Reject malformed read results too; none can authorize advancing the job. */
export function checkRead(name: string, value: unknown, mcp: McpConfig, args: Record<string, unknown>): void {
  if (name === "get_service") { if (value !== null) { const s = serviceSchema.parse(value); if (s.service_id !== args.serviceId) throw new Error("SERVICE_MISMATCH"); } return; }
  if (name === "list_services") { pageSchema.parse(value); return; }
  if (name === "get_policy") { if (value !== null && policySchema.parse(value).owner_id !== mcp.owner_id) throw new Error("OWNER_MISMATCH"); return; }
  if (name === "preview_payment") { if (!exactFields(value, ["authorization", "decision"]) || value.authorization !== "not_proven_by_view") throw new Error("INVALID_PREVIEW"); checkedDecision(value.decision); return; }
  if (name === "get_payment") {
    if (!exactFields(value, ["kind", "payment", "block"]) || !["settled", "failed"].includes(value.kind as string)) throw new Error("UNRESOLVED_PAYMENT_READ");
    const p = checkedPayment(value.payment, mcp.network, mcp.core_account, mcp.owner_id, args.paymentId as string);
    if (!p || p.state !== value.kind) throw new Error("INVALID_PAYMENT_READ");
    observePayment({ value: p, block: blockSchema.parse(value.block) }, mcp.owner_id, args.paymentId as string); return;
  }
  throw new Error("UNKNOWN_READ");
}
import { z } from "zod";
import { accountId, hash32 } from "../../../packages/mcp/src/schemas.js";
import { validateU128, validateU64, validateProfileId } from "../../../packages/near-sdk/src/codec.js";
const valid = (f: (v: string) => unknown) => (v: string) => { try { f(v); return true; } catch { return false; } };
const u32 = z.number().int().min(0).max(0xffffffff), u64 = z.string().max(20).refine(valid(validateU64));
const serviceSchema = z.object({ service_id: accountId, version: u32.min(1), payout_account: accountId, invoice_key: hash32, endpoint_hash: hash32, active: z.boolean() }).strict();
const pageSchema = z.object({ items: z.array(serviceSchema.extend({ registered: z.literal(true), configured: z.boolean(), eligibility: z.literal("not_evaluated") }).strict()).max(20), next_cursor: u64.nullable() }).strict();
const trust = z.object({ service_id: accountId, service_version: u32.min(1), payout_account: accountId, invoice_key: hash32, endpoint_hash: hash32, allowed_profile_ids: z.array(z.string().max(64).refine(valid(validateProfileId))).max(32), expires_at_ns: u64.nullable(), active: z.boolean() }).strict();
const policySchema = z.object({ owner_id: accountId, revision: u32, paused: z.boolean(), daily_cap_yocto: z.string().max(39).refine(valid(validateU128)), max_dispatches_per_minute: u32, trusted_services: z.array(trust).max(32), blocked_services: z.array(accountId).max(32), blocked_payouts: z.array(accountId).max(32) }).strict();
const blockSchema = z.object({ finality: z.literal("final"), block_hash: z.string().min(1).max(128), block_height: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict();

function checkedDecision(value: unknown) {
  const d = validateDecision(value);
  const fields = d.kind === "allow" ? ["kind"] : d.kind === "deny" ? ["kind", "code", ...(d.retry_after_ns === undefined ? [] : ["retry_after_ns"])] : ["kind", "code", "requirement"];
  if (!exactFields(d, fields) || d.kind === "require_validation" && !exactFields(d.requirement, ["capability_namespace", "capability_version", "conformance_suite_version", "conformance_suite_hash", "accepted_issuers"])) throw new Error("INVALID_DECISION");
  return d;
}
function checkedPayment(value: unknown, network: string, core: string, owner: string, id: string) {
  if (!exactFields(value, ["invoice", "invoice_hash", "credential", "dispatched_at_ns", "dispatch_day", "dispatch_minute", "state", "finalized_at_ns", "display_state"])) throw new Error("INVALID_PAYMENT");
  validateCredentialRef(value.credential); return validatePayment(value, network, core, owner, id);
}
