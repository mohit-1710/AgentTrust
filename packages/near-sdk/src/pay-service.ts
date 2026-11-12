import type { AgentTrustClient } from "./client.js";
import type { CredentialRef, Decision, FinalBlock, PaymentView, TransactionLocator, SubmissionResult, ServiceView } from "./views.js";
import type { SignedInvoiceV1 } from "./types.js";
import { readAuditCsv, type AuditReport } from "../../../examples/invoice-audit/src/audit.js";
import { checkAuditOutput } from "../../../examples/invoice-audit/src/check-output.js";
import { AttemptJournal, validateCredentialRef, type AttemptContext, type AttemptCheckpoint } from "./attempts.js";
import { invoiceHash, validateAccountId, validateHash32, validateSignedInvoice, verifyInvoiceSignature } from "./codec.js";
import { observePayment, validateDecision, validatePayment } from "./finality.js";
import { exactFields, MAX_HTTP_RESPONSE, PAID_PROTOCOL, readJson, type QuoteContext } from "./paid-protocol.js";
export interface PurchaseOptions {
  ownerId: string; sessionId: string; attemptsDirectory: string;
  credentials?: readonly { service_id: string; service_version: number; credential: CredentialRef }[];
  waitTimeoutMs?: number;
}
export interface PayServiceArgs { serviceId: string; csvUtf8: string; paymentId: string }
export type PaidAuditResult =
  { kind: "paid"; payment: PaymentView; block: FinalBlock; transaction: TransactionLocator; receipt_ids: string[]; report: AuditReport; output_check: { ok: true } } |
  { kind: "denied"; origin: "preview" | "executed_rejection" | "recorded_replay"; original_origin?: "preview"; payment_id: string; decision: Exclude<Decision, { kind: "allow" }>; transaction?: TransactionLocator; receipt_ids?: string[] } |
  { kind: "failed"; payment: PaymentView; block: FinalBlock; transaction: TransactionLocator } |
  { kind: "uncertain"; payment_id: string; reason: string; transaction?: TransactionLocator } |
  { kind: "retrieval_failed"; payment: PaymentView; block: FinalBlock; transaction: TransactionLocator; reason: string };
async function post(url: string, body: unknown, expectedStatus: number): Promise<unknown> {
  const response = await fetch(url, { method: "POST", redirect: "error", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (response.redirected || response.status >= 300 && response.status < 400 || response.url && response.url !== url) throw new Error("HTTP_REDIRECT");
  if (response.status !== expectedStatus || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new Error("HTTP_RESPONSE_INVALID");
  return readJson(response.body, MAX_HTTP_RESPONSE);
}
function validateOptions(options: PurchaseOptions): void {
  validateAccountId(options.ownerId); validateHash32(options.sessionId);
  if (options.waitTimeoutMs !== undefined && (!Number.isInteger(options.waitTimeoutMs) || options.waitTimeoutMs < 0 || options.waitTimeoutMs > 300_000)) throw new Error("INVALID_TIMEOUT");
  if ((options.credentials?.length ?? 0) > 128) throw new Error("CREDENTIAL_CONFIG_CAPACITY");
  const seen = new Set<string>();
  for (const entry of options.credentials ?? []) {
    validateAccountId(entry.service_id); validateCredentialRef(entry.credential);
    if (!Number.isInteger(entry.service_version) || entry.service_version < 1 || entry.service_version > 0xffffffff || seen.has(`${entry.service_id}/${entry.service_version}`)) throw new Error("INVALID_CREDENTIAL_CONFIG");
    seen.add(`${entry.service_id}/${entry.service_version}`);
  }
}
function checkedQuote(value: unknown, context: AttemptContext, fields: QuoteContext, service: ServiceView): SignedInvoiceV1 {
  try {
    if (!exactFields(value, ["protocol", "quote"]) || value.protocol !== PAID_PROTOCOL) throw new Error();
    const quote = value.quote as SignedInvoiceV1; validateSignedInvoice(quote);
    const invoice = quote.invoice;
    if (Object.entries({ ...context, ...fields }).some(([field, entry]) => invoice[field as keyof typeof invoice] !== entry) ||
        invoice.service_version !== service.version || invoice.payout_account !== service.payout_account || invoice.endpoint_hash !== service.endpoint_hash ||
        invoice.asset !== "NEAR" || BigInt(invoice.amount_yocto) <= 0n || !verifyInvoiceSignature(quote, service.invoice_key)) throw new Error();
    const now = BigInt(Date.now()) * 1_000_000n, issued = BigInt(invoice.issued_at_ns), expires = BigInt(invoice.expires_at_ns);
    if (issued > now + 5_000_000_000n || expires <= now || expires <= issued || expires - issued > 300_000_000_000n) throw new Error();
    return quote;
  } catch { throw new Error("INVALID_QUOTE"); }
}

/** One local attempt may submit at most one transaction. Resumption observes its saved locator. */
export async function payService(client: AgentTrustClient, options: PurchaseOptions, args: PayServiceArgs): Promise<PaidAuditResult> {
  options = structuredClone(options); args = structuredClone(args); validateOptions(options);
  if (!exactFields(args, ["serviceId", "csvUtf8", "paymentId"])) throw new Error("INVALID_PURCHASE_ARGS");
  validateAccountId(args.serviceId); validateHash32(args.paymentId);
  const context: AttemptContext = { network: client.network, core_account: client.coreAccount, owner_id: options.ownerId, service_id: args.serviceId, request_hash: readAuditCsv(args.csvUtf8).input_hash, payment_id: args.paymentId };
  const journal = new AttemptJournal(options.attemptsDirectory);
  let attempt = await journal.load(context);
  if (!attempt) {
    // Never manufacture a new quote for an existing chain operation whose local
    // original evidence is missing. Recover its original journal separately.
    const existing = await client.getPaymentSnapshot(context.owner_id, context.payment_id);
    if (existing.value !== null) return { kind: "uncertain", payment_id: context.payment_id, reason: "existing_payment_without_journal" };
    observePayment(existing, context.owner_id, context.payment_id); // Requires final view even when absent.
    const [service, policy, session] = await Promise.all([client.getService(args.serviceId), client.getPolicy(options.ownerId), client.getSession(options.ownerId, options.sessionId)]);
    if (!service || !policy || !session) throw new Error("PURCHASE_CONTEXT_UNAVAILABLE");
    const origin = client.directory.forNewPurchase(service);
    const fields: QuoteContext = { owner_id: options.ownerId, session_id: options.sessionId, payment_id: args.paymentId, policy_revision: policy.revision, profile_id: session.profile_id, profile_revision: session.profile_revision };
    const quote = checkedQuote(await post(`${origin}/v1/invoice-audit`, { mode: "quote", csv_utf8: args.csvUtf8, context: fields }, 402), context, fields, service);
    const credential = options.credentials?.find((entry) => entry.service_id === service.service_id && entry.service_version === service.version)?.credential ?? null;
    attempt = await journal.save({ schema_version: 1, context, quote, credential, invoice_hash: invoiceHash(quote.invoice), invoice_key: service.invoice_key });
  }
  const saved = attempt;
  const executeArgs = { quote: saved.quote, credential: saved.credential };
  async function finish(checkpoint: AttemptCheckpoint, known?: SubmissionResult, replay = false): Promise<PaidAuditResult> {
    if (checkpoint.kind === "preview_rejection") return { kind: "denied", origin: replay ? "recorded_replay" : "preview", ...(replay ? { original_origin: "preview" as const } : {}), payment_id: args.paymentId, decision: checkpoint.decision };
    const transaction = checkpoint.transaction;
    const uncertain = (reason: string): PaidAuditResult => ({ kind: "uncertain", payment_id: args.paymentId, transaction, reason });
    let submission: SubmissionResult;
    try { submission = known ?? await client.resolveSubmission(transaction, executeArgs); }
    catch { return uncertain("submission_unavailable"); }
    if (submission.transaction.tx_hash !== transaction.tx_hash || submission.transaction.sender_account_id !== transaction.sender_account_id) return uncertain("submission_binding_mismatch");
    let observation: Awaited<ReturnType<AgentTrustClient["awaitPayment"]>>;
    try { observation = await client.awaitPayment(context.owner_id, context.payment_id, options.waitTimeoutMs ?? 10_000); }
    catch { return uncertain("payment_unavailable"); }
    if (observation.payment) {
      try {
        const payment = validatePayment(observation.payment, context.network, context.core_account, context.owner_id, context.payment_id);
        if (!payment || payment.invoice_hash !== saved.invoice_hash) throw new Error();
        if (observation.block) observePayment({ value: payment, block: observation.block }, context.owner_id, context.payment_id);
      } catch { return uncertain("payment_binding_mismatch"); }
    }
    if (observation.kind === "failed") return { kind: "failed", payment: observation.payment, block: observation.block, transaction };
    if (observation.kind === "uncertain") {
      // Only the final outcome of the ONE saved transaction can prove that our
      // attempt did not dispatch. No later rebroadcast can mask an older unknown.
      if (observation.reason === "not_found" && submission.kind === "final" && submission.admission.kind === "rejected") return { kind: "denied", origin: "executed_rejection", payment_id: args.paymentId, decision: submission.admission.decision, transaction, receipt_ids: submission.receipt_ids };
      return uncertain(observation.reason);
    }
    if (submission.kind !== "final" || submission.admission.kind !== "payment" || submission.admission.payment.invoice_hash !== saved.invoice_hash) return uncertain("final_payment_receipt_unavailable");
    try {
      const origin = client.directory.forSettledInvoice(saved.quote.invoice);
      const response = await post(`${origin}/v1/invoice-audit`, { mode: "redeem", csv_utf8: args.csvUtf8, quote: saved.quote, credential: saved.credential, transaction }, 200);
      if (!exactFields(response, ["protocol", "invoice_hash", "report"]) || response.protocol !== PAID_PROTOCOL || response.invoice_hash !== saved.invoice_hash) throw new Error("OUTPUT_BINDING_MISMATCH");
      const output_check = checkAuditOutput(args.csvUtf8, response.report);
      if (!output_check.ok) throw new Error(output_check.code);
      return { kind: "paid", payment: observation.payment, block: observation.block, transaction, receipt_ids: submission.receipt_ids, report: response.report as AuditReport, output_check };
    } catch (failure) {
      return { kind: "retrieval_failed", payment: observation.payment, block: observation.block, transaction, reason: failure instanceof Error ? failure.message : "RETRIEVAL_FAILED" };
    }
  }
  const checkpoint = await journal.checkpoint(saved);
  if (checkpoint) return finish(checkpoint, undefined, true);
  const preview = await client.previewPayment(executeArgs);
  if (preview.authorization !== "not_proven_by_view") throw new Error("INVALID_PREVIEW");
  const decision = validateDecision(preview.decision);
  if (decision.kind !== "allow") {
    const claimed = await journal.claim(saved, { schema_version: 1, invoice_hash: saved.invoice_hash, kind: "preview_rejection", decision });
    return finish(claimed.checkpoint, undefined, !claimed.created);
  }
  try {
    const result = await client.executePayment(executeArgs, { beforeBroadcast: async (transaction) => {
      const claimed = await journal.claim(saved, { schema_version: 1, invoice_hash: saved.invoice_hash, kind: "submission", transaction });
      if (!claimed.created) throw new Error("ATTEMPT_ALREADY_CLAIMED");
    } });
    const checkpoint = await journal.checkpoint(saved);
    if (!checkpoint) throw new Error("MISSING_BROADCAST_CHECKPOINT");
    return finish(checkpoint, result);
  } catch (failure) {
    const checkpoint = await journal.checkpoint(saved);
    if (checkpoint) return finish(checkpoint, undefined, true);
    throw failure; // No durable checkpoint means no broadcast was authorized.
  }
}
