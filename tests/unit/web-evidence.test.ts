import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { paymentEvidence, rejectionEvidence } from "../../web/lib/near/evidence.js";
import { invoiceHash } from "../../packages/near-sdk/src/codec.js";
import type { InvoiceV1 } from "../../packages/near-sdk/src/types.js";
import type { PaymentView } from "../../packages/near-sdk/src/views.js";
import type { RejectedCall } from "../../web/lib/near/types.js";

const invoice = JSON.parse(readFileSync(new URL("../../fixtures/protocol/v1/vectors.json", import.meta.url), "utf8")).invoices[0].input as InvoiceV1;
const observedAt = "2026-11-12T12:00:00.000Z";
const credential = { issuer_id: "issuer.testnet", credential_id: Buffer.alloc(32, 5).toString("base64"), revision: 3 };
const payment = (state: PaymentView["state"] = "pending"): PaymentView => ({ invoice, invoice_hash: invoiceHash(invoice), credential,
  dispatched_at_ns: "1000", dispatch_day: "0", dispatch_minute: "0", state, display_state: state, finalized_at_ns: state === "pending" ? "0" : "2000" });
const transaction = { tx_hash: "11111111111111111111111111111111", sender_account_id: invoice.owner_id };
const rejection = (): RejectedCall => ({ origin: "executed_rejection", invoice, invoice_hash: invoiceHash(invoice), credential,
  decision: { kind: "deny", code: "DAILY_CAP" }, transaction, receipt_ids: ["core-receipt"] });
const fields = (detail: ReturnType<typeof paymentEvidence>) => Object.fromEntries(detail.fields.map((field) => [field.label, field.value]));

describe("public payment evidence", () => {
  it("preserves exact immutable bindings and a dated final-view observation", () => {
    const record = payment();
    const detail = paymentEvidence(record, observedAt);
    const json = JSON.parse(detail.json);
    expect(json.origin).toBe("final_contract_view");
    expect(json.observed_at).toBe(observedAt);
    expect(json.record).toEqual(record);
    expect(fields(detail)).toMatchObject({
      "Payment ID": invoice.payment_id, "Invoice hash": record.invoice_hash,
      "Request hash": invoice.request_hash, "Policy revision": String(invoice.policy_revision),
      "Session ID": invoice.session_id, "Endpoint hash": invoice.endpoint_hash,
      "Amount": "0.001 NEAR · 1000000000000000000000 yoctoNEAR",
    });
    expect(detail.fields.find((field) => field.label === "Payout")?.href).toBe("https://testnet.nearblocks.io/address/" + invoice.payout_account);
    expect(json.transaction).toBeNull();
    expect(json.receipt_ids).toEqual([]);
    expect(detail.fields.filter((field) => field.href?.includes("/txns/"))).toEqual([]);
  });
  it.each(["pending", "settled", "failed"] as const)("does not turn %s into checked output or a valid credential", (state) => {
    const json = JSON.parse(paymentEvidence(payment(state), observedAt).json);
    expect(json.claims.admission).toBe("recorded");
    expect(json.claims.settlement).toBe(state);
    expect(json.claims.output_check).toBe("not_observed");
    expect(json.claims.capability).toBe("reference_only");
    expect(json.claims.credential_assertion).toBe("not_retained_in_payment_record");
  });
  it("keeps reconciliation reserved and shows credential assertion gaps explicitly", () => {
    const detail = paymentEvidence({ ...payment(), display_state: "needs_reconciliation" }, observedAt);
    expect(fields(detail)["Settlement"]).toContain("reserved");
    expect(fields(detail)["Credential suite / expiry"]).toContain("not retained");
    expect(fields(detail)["Credential reference"]).toContain("issuer.testnet");
    expect(JSON.parse(detail.json).claims.settlement).toBe("pending");
  });
  it("distinguishes absence of a credential reference from a failed validation", () => {
    const detail = paymentEvidence({ ...payment(), credential: null }, observedAt);
    expect(JSON.parse(detail.json).claims.capability).toBe("no_reference_recorded");
    expect(fields(detail)["Credential reference"]).toBe("None recorded");
    expect(detail.json).not.toContain('"valid":true');
  });
  it("projects only the documented public fields, without mutating its inputs", () => {
    const record = { ...payment(), csv_utf8: "private csv", private_key: "secret", invoice: { ...invoice, token: "secret" }, credential: { ...credential, report: "private report" } };
    const before = structuredClone(record);
    const detail = paymentEvidence(record, observedAt);
    expect(JSON.parse(detail.json).record).toEqual(payment());
    expect(detail.json).not.toMatch(/secret|private csv|private report|csv_utf8|private_key|token/);
    expect(record).toEqual(before);
  });
});

describe("executed rejection evidence", () => {
  it("shows actual call references without asserting the purchase is unpaid", () => {
    const detail = rejectionEvidence(rejection(), observedAt);
    const json = JSON.parse(detail.json);
    expect(json.origin).toBe("executed_rejection");
    expect(json.observed_at).toBe(observedAt);
    expect(json.transaction).toEqual(transaction);
    expect(json.receipt_ids).toEqual(["core-receipt"]);
    expect(json.claims).toMatchObject({ admission: "rejected_by_this_call", settlement: "not_established", output_check: "not_observed" });
    expect(detail.note).toContain("earlier submission");
    expect(detail.fields.find((field) => field.label === "Transaction")?.href).toBe("https://testnet.nearblocks.io/txns/" + transaction.tx_hash);
  });
  it("labels required suite and issuers as requirements, never achieved credential evidence", () => {
    const requirement = { capability_namespace: "invoice.audit" as const, capability_version: 1 as const, conformance_suite_version: 1,
      conformance_suite_hash: Buffer.alloc(32, 6).toString("base64"), accepted_issuers: ["issuer.testnet"] };
    const detail = rejectionEvidence({ ...rejection(), decision: { kind: "require_validation", code: "REVOKED", requirement } }, observedAt);
    expect(fields(detail)["Required suite"]).toBe(`v1 · ${requirement.conformance_suite_hash}`);
    expect(fields(detail)["Accepted issuers required"]).toBe("issuer.testnet");
    expect(fields(detail)["Credential suite / expiry"]).toContain("not retained");
    expect(JSON.parse(detail.json).decision.requirement).toEqual(requirement);
    expect(JSON.parse(detail.json).claims.capability).toBe("requirement_not_satisfied");
  });
  it("strips unknown fields from submitted credentials, transaction and decisions", () => {
    const call = { ...rejection(), credential: { ...credential, api_key: "secret" },
      transaction: { ...transaction, private_key: "secret" }, decision: { kind: "deny" as const, code: "RATE_LIMIT" as const, retry_after_ns: "1000", csv_utf8: "private csv" } };
    const json = JSON.parse(rejectionEvidence(call, observedAt).json);
    expect(json.credential).toEqual(credential);
    expect(json.decision).toEqual({ kind: "deny", code: "RATE_LIMIT", retry_after_ns: "1000" });
    expect(json.transaction).toEqual(transaction);
    expect(JSON.stringify(json)).not.toMatch(/secret|private csv|api_key|private_key|csv_utf8/);
  });
});
