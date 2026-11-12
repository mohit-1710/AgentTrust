import type { InvoiceV1 } from "../../../packages/near-sdk/src/types.js";
import type { CredentialRef, Decision, PaymentView } from "../../../packages/near-sdk/src/views.js";
import { accountUrl, formatNear, transactionUrl } from "./format.js";
import type { RejectedCall } from "./types.js";

export interface EvidenceField { label: string; value: string; href?: string }
export interface EvidenceDetail { fields: EvidenceField[]; note: string; json: string }

// Project the public ABI explicitly: RPC extensions never enter the inspector or JSON.
function publicInvoice(value: InvoiceV1): InvoiceV1 {
  const { schema_version, network, core_account, owner_id, session_id, payment_id, policy_revision, profile_id,
    profile_revision, service_id, service_version, payout_account, endpoint_hash, request_hash, asset,
    amount_yocto, issued_at_ns, expires_at_ns } = value;
  return { schema_version, network, core_account, owner_id, session_id, payment_id, policy_revision, profile_id,
    profile_revision, service_id, service_version, payout_account, endpoint_hash, request_hash, asset,
    amount_yocto, issued_at_ns, expires_at_ns };
}
function publicCredential(value: CredentialRef | null): CredentialRef | null {
  return value === null ? null : { issuer_id: value.issuer_id, credential_id: value.credential_id, revision: value.revision };
}
export function publicDecision(value: Exclude<Decision, { kind: "allow" }>): Exclude<Decision, { kind: "allow" }> {
  if (value.kind === "deny") return { kind: value.kind, code: value.code,
    ...(value.retry_after_ns !== undefined ? { retry_after_ns: value.retry_after_ns } : {}) };
  const requirement = value.requirement;
  return { kind: value.kind, code: value.code, requirement: {
    capability_namespace: requirement.capability_namespace, capability_version: requirement.capability_version,
    conformance_suite_version: requirement.conformance_suite_version, conformance_suite_hash: requirement.conformance_suite_hash,
    accepted_issuers: [...requirement.accepted_issuers],
  } };
}
export function publicPayment(value: PaymentView): PaymentView {
  return { invoice: publicInvoice(value.invoice), invoice_hash: value.invoice_hash, credential: publicCredential(value.credential),
    dispatched_at_ns: value.dispatched_at_ns, dispatch_day: value.dispatch_day, dispatch_minute: value.dispatch_minute,
    state: value.state, finalized_at_ns: value.finalized_at_ns, display_state: value.display_state };
}
function timestamp(ns: string): string {
  return `${new Date(Number(BigInt(ns) / BigInt(1_000_000))).toISOString()} · ${ns} ns`;
}
function boundFields(invoice: InvoiceV1, hash: string, credential: CredentialRef | null): EvidenceField[] {
  return [
    { label: "Network", value: invoice.network },
    { label: "Core", value: invoice.core_account, href: accountUrl(invoice.core_account) },
    { label: "Owner", value: invoice.owner_id, href: accountUrl(invoice.owner_id) },
    { label: "Service", value: `${invoice.service_id} · version ${invoice.service_version}`, href: accountUrl(invoice.service_id) },
    { label: "Payout", value: invoice.payout_account, href: accountUrl(invoice.payout_account) },
    { label: "Amount", value: `${formatNear(invoice.amount_yocto)} · ${invoice.amount_yocto} yoctoNEAR` },
    { label: "Policy revision", value: String(invoice.policy_revision) },
    { label: "Profile", value: `${invoice.profile_id} · revision ${invoice.profile_revision}` },
    { label: "Session ID", value: invoice.session_id },
    { label: "Payment ID", value: invoice.payment_id },
    { label: "Invoice hash", value: hash },
    { label: "Request hash", value: invoice.request_hash },
    { label: "Endpoint hash", value: invoice.endpoint_hash },
    { label: "Invoice expiry", value: timestamp(invoice.expires_at_ns) },
    { label: "Credential reference", value: credential ? `${credential.issuer_id} · ${credential.credential_id} · revision ${credential.revision}` : "None recorded" },
    { label: "Credential suite / expiry", value: "Historical assertion not retained in this evidence; current registry state is not substituted." },
  ];
}

export function paymentEvidence(payment: PaymentView, observedAt: string): EvidenceDetail {
  const record = publicPayment(payment);
  const settlement = record.state === "settled" ? "Settled by the contract callback; output not established"
    : record.state === "failed" ? "Failed transfer; this record is terminal"
      : "Pending; funds remain reserved, with no automatic refund";
  const note = "This is a current final contract observation of an existing payment. It records admission; current policy permission and HTTP output quality are not established. RPC observations are not light-client proofs.";
  return {
    fields: [
      { label: "Origin", value: "Final contract view · current observation" },
      { label: "Observed at", value: observedAt },
      { label: "Admission", value: "Recorded by the contract" },
      { label: "Settlement", value: settlement },
      { label: "Output check", value: "Not observed; no checked HTTP report is attached" },
      ...boundFields(record.invoice, record.invoice_hash, record.credential),
      { label: "Dispatched at", value: timestamp(record.dispatched_at_ns) },
      { label: "Finalized at", value: record.state === "pending" ? "Not finalized" : timestamp(record.finalized_at_ns) },
      { label: "Transaction / receipts", value: "Not supplied by this payment view; payment IDs are not transaction hashes" },
    ], note,
    json: JSON.stringify({ schema_version: 1, origin: "final_contract_view", observed_at: observedAt, finality: "final",
      claims: { admission: "recorded", settlement: record.state, capability: record.credential ? "reference_only" : "no_reference_recorded",
        credential_assertion: "not_retained_in_payment_record", output_check: "not_observed" },
      record, transaction: null, receipt_ids: [], evidence_limit: note,
    }, null, 2),
  };
}

export function rejectionEvidence(rejection: RejectedCall, observedAt: string): EvidenceDetail {
  const invoice = publicInvoice(rejection.invoice), credential = publicCredential(rejection.credential);
  const decision = publicDecision(rejection.decision);
  const transaction = { tx_hash: rejection.transaction.tx_hash, sender_account_id: rejection.transaction.sender_account_id };
  const note = "This final call was rejected before dispatch. It does not establish whether an earlier submission for this purchase paid or can still execute. The observation time is not the transaction execution time.";
  return {
    fields: [
      { label: "Origin", value: "Executed rejection · final matching core response" },
      { label: "Observed at", value: observedAt },
      { label: "Admission", value: `Rejected by this call · ${decision.code}` },
      { label: "Settlement", value: "Not established for the purchase by this rejected call" },
      { label: "Output check", value: "Not observed; no checked HTTP report is attached" },
      ...boundFields(invoice, rejection.invoice_hash, credential),
      ...(decision.kind === "require_validation" ? [
        { label: "Required capability", value: `${decision.requirement.capability_namespace}.v${decision.requirement.capability_version}` },
        { label: "Required suite", value: `v${decision.requirement.conformance_suite_version} · ${decision.requirement.conformance_suite_hash}` },
        { label: "Accepted issuers required", value: decision.requirement.accepted_issuers.join(", ") },
      ] : []),
      { label: "Transaction", value: transaction.tx_hash, href: transactionUrl(transaction.tx_hash) },
      { label: "Receipt IDs", value: rejection.receipt_ids.join("\n") },
    ], note,
    json: JSON.stringify({ schema_version: 1, origin: "executed_rejection", observed_at: observedAt, final_execution_status: "FINAL",
      claims: { admission: "rejected_by_this_call", settlement: "not_established",
        capability: decision.kind === "require_validation" ? "requirement_not_satisfied" : "not_established", output_check: "not_observed" },
      invoice, invoice_hash: rejection.invoice_hash, credential, decision, transaction,
      receipt_ids: [...rejection.receipt_ids], evidence_limit: note,
    }, null, 2),
  };
}
