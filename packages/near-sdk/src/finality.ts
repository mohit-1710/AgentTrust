import { encodeInvoice, invoiceHash, validateAccountId, validateHash32, validateU64, validateU128, validateSignedInvoice } from "./codec.js";
import type { FinalSnapshot, PaymentObservation, PaymentView, TransactionLocator, ExecutionResult, Decision, ExecutePaymentArgs, CredentialRef } from "./views.js";

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const denialCodes = new Set(["UNAUTHORIZED", "SESSION_REVOKED", "SESSION_EXPIRED", "PAUSED", "PROFILE_MISMATCH", "POLICY_CHANGED", "DOMAIN_MISMATCH", "INVALID_INVOICE", "INVOICE_EXPIRED", "IDENTITY_CHANGED", "BLOCKED_SERVICE", "BLOCKED_PAYOUT", "PURCHASE_CAP", "DAILY_CAP", "RATE_LIMIT", "INSUFFICIENT_FUNDS", "INSUFFICIENT_BACKING", "STORAGE_CREDIT", "CAPACITY", "UNKNOWN_SERVICE", "PAYMENT_ID_CONFLICT"]);
const credentialCodes = new Set(["MISSING", "UNACCEPTED_ISSUER", "WRONG_SUBJECT", "WRONG_SCOPE", "WRONG_SUITE", "EXPIRED", "REVOKED", "REVISION_CHANGED"]);

export function validateDecision(value: unknown): Decision {
  if (!object(value)) throw new TypeError("INVALID_DECISION");
  if (value.kind === "allow") return { kind: "allow" };
  if (value.kind === "deny" && typeof value.code === "string" && denialCodes.has(value.code)) {
    if (value.retry_after_ns !== undefined) validateU64(value.retry_after_ns as string);
    return value as Decision;
  }
  if (value.kind === "require_validation" && typeof value.code === "string" && credentialCodes.has(value.code) && object(value.requirement)) {
    const r = value.requirement;
    if (r.capability_namespace === "invoice.audit" && r.capability_version === 1 && Number.isInteger(r.conformance_suite_version) &&
        (r.conformance_suite_version as number) > 0 && (r.conformance_suite_version as number) <= 0xffffffff && Array.isArray(r.accepted_issuers) && r.accepted_issuers.length >= 1 && r.accepted_issuers.length <= 4) {
      validateHash32(r.conformance_suite_hash as string);
      for (const issuer of r.accepted_issuers) validateAccountId(issuer as string);
      if (new Set(r.accepted_issuers).size !== r.accepted_issuers.length) throw new TypeError("INVALID_DECISION");
      return value as Decision;
    }
  }
  throw new TypeError("INVALID_DECISION");
}

/** Final RPC data is still untrusted input; bind it to the exact requested operation. */
export function validatePayment(value: unknown, network: string, core: string, owner: string, id: string): PaymentView | null {
  if (value === null) return null;
  if (!object(value) || !object(value.invoice)) throw new TypeError("INVALID_PAYMENT");
  const payment = value as unknown as PaymentView;
  encodeInvoice(payment.invoice);
  if (payment.invoice.network !== network || payment.invoice.core_account !== core || payment.invoice.owner_id !== owner || payment.invoice.payment_id !== id ||
      payment.invoice.schema_version !== 1 || payment.invoice.asset !== "NEAR" || payment.invoice_hash !== invoiceHash(payment.invoice)) throw new Error("PAYMENT_BINDING_MISMATCH");
  for (const amount of [payment.dispatched_at_ns, payment.dispatch_day, payment.dispatch_minute, payment.finalized_at_ns]) validateU64(amount);
  if (!["pending", "settled", "failed"].includes(payment.state) ||
      !(payment.display_state === payment.state || payment.state === "pending" && payment.display_state === "needs_reconciliation") ||
      payment.state === "pending" && payment.finalized_at_ns !== "0") throw new TypeError("INVALID_PAYMENT_STATE");
  if (payment.credential !== null) {
    if (!object(payment.credential)) throw new TypeError("INVALID_CREDENTIAL_REF");
    validateAccountId(payment.credential.issuer_id); validateHash32(payment.credential.credential_id);
    if (!Number.isInteger(payment.credential.revision) || payment.credential.revision < 1 || payment.credential.revision > 0xffffffff) throw new TypeError("INVALID_CREDENTIAL_REF");
  }
  return payment;
}

export function observePayment(snapshot: FinalSnapshot<PaymentView | null>, owner: string, id: string): PaymentObservation {
  if (snapshot.block.finality !== "final" || !snapshot.block.block_hash || !Number.isSafeInteger(snapshot.block.block_height) || snapshot.block.block_height < 0) throw new Error("FINAL_STATE_REQUIRED");
  const payment = snapshot.value;
  if (payment === null) return { kind: "uncertain", owner_id: owner, payment_id: id, reason: "not_found", block: snapshot.block };
  if (payment.invoice.owner_id !== owner || payment.invoice.payment_id !== id) throw new Error("PAYMENT_BINDING_MISMATCH");
  if (payment.state === "settled" || payment.state === "failed") return { kind: payment.state, payment, block: snapshot.block };
  return { kind: "uncertain", owner_id: owner, payment_id: id, reason: "pending", payment, block: snapshot.block };
}

function sameSubmittedCredential(value: unknown, expected: CredentialRef | null): boolean {
  if (expected === null) return value === null;
  if (!object(expected) || Object.keys(expected).length !== 3) return false;
  validateAccountId(expected.issuer_id); validateHash32(expected.credential_id);
  if (!Number.isInteger(expected.revision) || expected.revision < 0 || expected.revision > 0xffffffff) return false;
  return object(value) && Object.keys(value).length === 3 &&
    value.issuer_id === expected.issuer_id && value.credential_id === expected.credential_id && value.revision === expected.revision;
}

/** A final call response is admission evidence, not a claim of payment settlement. */
export function finalAdmission(raw: unknown, locator: TransactionLocator, core: string, expectedArgs: ExecutePaymentArgs): { admission: ExecutionResult; receipt_ids: string[] } | null {
  try {
    if (!object(raw) || raw.final_execution_status !== "FINAL" || !object(raw.transaction) ||
        raw.transaction.hash !== locator.tx_hash || raw.transaction.signer_id !== locator.sender_account_id || raw.transaction.receiver_id !== core ||
        !object(raw.status) || typeof raw.status.SuccessValue !== "string" || !Array.isArray(raw.receipts_outcome)) return null;
    if (!Array.isArray(raw.transaction.actions) || raw.transaction.actions.length !== 1 || !object(raw.transaction.actions[0]) || !object(raw.transaction.actions[0].FunctionCall)) return null;
    const call = raw.transaction.actions[0].FunctionCall;
    if (call.method_name !== "execute_payment" || call.deposit !== "0" || typeof call.args !== "string") return null;
    const callBytes = Buffer.from(call.args, "base64");
    if (callBytes.length > 64 * 1024 || callBytes.toString("base64") !== call.args) return null;
    const args = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(callBytes)) as import("./views.js").ExecutePaymentArgs;
    validateSignedInvoice(args.quote);
    validateSignedInvoice(expectedArgs.quote);
    const expectedInvoiceHash = invoiceHash(expectedArgs.quote.invoice);
    if (args.quote.signature !== expectedArgs.quote.signature || !sameSubmittedCredential(args.credential, expectedArgs.credential)) return null;
    if (args.quote.invoice.core_account !== core || args.quote.invoice.owner_id !== locator.sender_account_id || invoiceHash(args.quote.invoice) !== expectedInvoiceHash) return null;
    const encoded = raw.status.SuccessValue;
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > 64 * 1024 || bytes.toString("base64") !== encoded) return null;
    const value: unknown = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
    if (!object(value)) return null;
    let admission: ExecutionResult;
    if (value.kind === "rejected") {
      const decision = validateDecision(value.decision);
      if (decision.kind === "allow") return null;
      admission = { kind: "rejected", decision };
    } else if (value.kind === "payment" && object(value.payment) && object(value.payment.invoice) && typeof value.duplicate === "boolean") {
      const payment = validatePayment(value.payment, "near:testnet", core, locator.sender_account_id, value.payment.invoice.payment_id as string);
      if (!payment || payment.invoice_hash !== expectedInvoiceHash) return null;
      admission = { kind: "payment", payment, duplicate: value.duplicate };
    } else return null;
    const matching = raw.receipts_outcome.filter((item) => object(item) && typeof item.id === "string" && object(item.outcome) && item.outcome.executor_id === core &&
      object(item.outcome.status) && item.outcome.status.SuccessValue === encoded);
    if (matching.length !== 1) return null;
    const receipt_ids = raw.receipts_outcome.map((item) => { if (!object(item) || typeof item.id !== "string") throw new TypeError("INVALID_RECEIPT"); return item.id; });
    return { admission, receipt_ids };
  } catch { return null; }
}

export function assertRestrictedWorkerKey(permission: unknown, core: string): void {
  try {
    if (!object(permission) || Object.keys(permission).length !== 1 || !object(permission.FunctionCall)) throw new Error();
    const scope = permission.FunctionCall;
    if (scope.receiver_id !== core || !Array.isArray(scope.method_names) || scope.method_names.length !== 1 || scope.method_names[0] !== "execute_payment") throw new Error();
    // near-api-js's raw RPC uses strings; viewAccessKey currently preserves allowance.
    validateU128(scope.allowance as string);
    if (BigInt(scope.allowance as string) === 0n) throw new Error();
  } catch { throw new Error("UNSAFE_WORKER_KEY"); }
}
