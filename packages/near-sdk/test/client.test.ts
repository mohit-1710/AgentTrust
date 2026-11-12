import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalOrigin, endpointHash, ServiceDirectory } from "../src/directory.js";
import { assertRestrictedWorkerKey, finalAdmission, observePayment, validatePayment } from "../src/finality.js";
import { invoiceHash } from "../src/codec.js";
import type { InvoiceV1 } from "../src/types.js";
import type { ExecutionResult, PaymentView, ServiceView, TransactionLocator } from "../src/views.js";
const invoice = JSON.parse(readFileSync(new URL("../../../fixtures/protocol/v1/vectors.json", import.meta.url), "utf8")).invoices[0].input as InvoiceV1;
const payment = (state: PaymentView["state"] = "settled"): PaymentView => ({
  invoice, invoice_hash: invoiceHash(invoice), credential: null, dispatched_at_ns: "1000", dispatch_day: "0", dispatch_minute: "0",
  state, finalized_at_ns: state === "pending" ? "0" : "2000", display_state: state,
});
const block = { finality: "final" as const, block_hash: "block-hash", block_height: 20 };
const origin = "https://audit.example";
const service = (): ServiceView => ({ service_id: invoice.service_id, version: invoice.service_version, payout_account: invoice.payout_account,
  invoice_key: Buffer.alloc(32, 1).toString("base64"), endpoint_hash: endpointHash(origin), active: true });
const locator: TransactionLocator = { tx_hash: "tx-hash", sender_account_id: invoice.owner_id };
const admission: ExecutionResult = { kind: "payment", payment: payment("pending"), duplicate: false };
const rawResult = () => ({ final_execution_status: "FINAL", transaction: { hash: locator.tx_hash, signer_id: locator.sender_account_id, receiver_id: invoice.core_account, actions: [{ FunctionCall: { method_name: "execute_payment", deposit: "0", args: Buffer.from(JSON.stringify({quote:{invoice,signature:Buffer.alloc(64).toString("base64")},credential:null})).toString("base64") } }] },
  status: { SuccessValue: Buffer.from(JSON.stringify(admission)).toString("base64") },
  receipts_outcome: [{ id: "receipt", outcome: { executor_id: invoice.core_account, status: { SuccessValue: Buffer.from(JSON.stringify(admission)).toString("base64") } } }],
});

describe("native directory", () => {
  it("commits the existing exact endpoint recipe and distinguishes registration from configuration", () => {
    expect(endpointHash(origin)).toBe("uMN+YPlApjFYcaBF8uW+LFLdQYgUrAeuXmlggBOKyOs=");
    const directory = new ServiceDirectory([{ service_id: invoice.service_id, service_version: invoice.service_version, origin }]);
    expect(directory.forNewPurchase(service())).toBe(origin);
    expect(directory.isConfigured(service())).toBe(true);
    expect(new ServiceDirectory([]).isConfigured(service())).toBe(false);
  });
  it.each(["http://audit.example", "https://audit.example/", "https://AUDIT.example", "https://audit.example/path", "https://user@audit.example", "https://audit.example?x=1", "https://audit.example#x", "https://audit.example:443"])("rejects noncanonical origin %s", (value) => {
    expect(() => canonicalOrigin(value)).toThrow();
  });
  it("rejects missing/duplicate versions and endpoint changes before HTTP use", () => {
    expect(() => new ServiceDirectory([{ service_id: invoice.service_id, service_version: 1, origin }, { service_id: invoice.service_id, service_version: 1, origin }])).toThrow();
    const directory = new ServiceDirectory([{ service_id: invoice.service_id, service_version: invoice.service_version, origin }]);
    expect(() => directory.forNewPurchase({ ...service(), version: invoice.service_version + 1 })).toThrow("ENDPOINT_UNCONFIGURED");
    expect(() => directory.forNewPurchase({ ...service(), endpoint_hash: Buffer.alloc(32).toString("base64") })).toThrow("ENDPOINT_MISMATCH");
    expect(() => directory.forNewPurchase({ ...service(), active: false })).toThrow("INACTIVE_SERVICE");
    expect(() => new ServiceDirectory(Array.from({ length: 129 }, (_, i) => ({ service_id: `audit${i}.testnet`, service_version: 1, origin })))).toThrow();
  });
  it("resolves a settled invoice from its retained original identity after registry rotation", () => {
    const directory = new ServiceDirectory([{ service_id: invoice.service_id, service_version: invoice.service_version, origin }]);
    expect(directory.forSettledInvoice({ ...invoice, endpoint_hash: endpointHash(origin), expires_at_ns: "1" })).toBe(origin);
    expect(() => directory.forNewPurchase({ ...service(), version: invoice.service_version + 1 })).toThrow();
  });
});

describe("final state and submission evidence", () => {
  it.each(["pending", "settled", "failed"] as const)("validates immutable %s payment binding", (state) => {
    expect(validatePayment(payment(state), invoice.network, invoice.core_account, invoice.owner_id, invoice.payment_id)).toEqual(payment(state));
  });
  it("rejects wrong owner, operation, domain, or immutable hash", () => {
    for (const args of [["near:mainnet", invoice.core_account, invoice.owner_id, invoice.payment_id], [invoice.network, "other.testnet", invoice.owner_id, invoice.payment_id], [invoice.network, invoice.core_account, "other.testnet", invoice.payment_id], [invoice.network, invoice.core_account, invoice.owner_id, Buffer.alloc(32).toString("base64")]]) {
      expect(() => validatePayment(payment(), ...args as [string,string,string,string])).toThrow();
    }
    expect(() => validatePayment({ ...payment(), invoice_hash: Buffer.alloc(32).toString("base64") }, invoice.network, invoice.core_account, invoice.owner_id, invoice.payment_id)).toThrow();
  });
  it("null and pending remain uncertain even at a final block", () => {
    expect(observePayment({ value: null, block }, invoice.owner_id, invoice.payment_id).kind).toBe("uncertain");
    expect(observePayment({ value: payment("pending"), block }, invoice.owner_id, invoice.payment_id).kind).toBe("uncertain");
    expect(observePayment({ value: payment(), block }, invoice.owner_id, invoice.payment_id).kind).toBe("settled");
    expect(observePayment({ value: payment("failed"), block }, invoice.owner_id, invoice.payment_id).kind).toBe("failed");
  });
  it.each(["NONE", "INCLUDED", "EXECUTED", "INCLUDED_FINAL", "EXECUTED_OPTIMISTIC"])("%s response is not final admission or settlement", (status) => {
    expect(finalAdmission({ ...rawResult(), final_execution_status: status }, locator, invoice.core_account, quoteArgs)).toBeNull();
  });
  it("accepts an actual final contract response while preserving Pending admission", () => {
    expect(finalAdmission(rawResult(), locator, invoice.core_account, quoteArgs)).toEqual({ admission, receipt_ids: ["receipt"] });
  });
  it("rejects a final response whose transaction paid a different quote", () => {
    const raw = rawResult();
    raw.transaction.actions[0]!.FunctionCall.args = Buffer.from(JSON.stringify({quote:{invoice:{...invoice,amount_yocto:"2"},signature:Buffer.alloc(64).toString("base64")},credential:null})).toString("base64");
    expect(finalAdmission(raw, locator, invoice.core_account, quoteArgs)).toBeNull();
  });
  it("a hash or HTTP success without bound final outcome cannot be promoted", () => {
    expect(finalAdmission({ tx_hash: locator.tx_hash }, locator, invoice.core_account, quoteArgs)).toBeNull();
    expect(finalAdmission({ ...rawResult(), transaction: { ...rawResult().transaction, signer_id: "other.testnet" } }, locator, invoice.core_account, quoteArgs)).toBeNull();
    expect(finalAdmission({ ...rawResult(), status: { Failure: {} } }, locator, invoice.core_account, quoteArgs)).toBeNull();
    expect(finalAdmission({ ...rawResult(), receipts_outcome: [] }, locator, invoice.core_account, quoteArgs)).toBeNull();
  });
});

describe("restricted worker permission", () => {
  it("accepts only exact method/receiver and finite positive allowance", () => {
    expect(() => assertRestrictedWorkerKey({ FunctionCall: { receiver_id: invoice.core_account, method_names: ["execute_payment"], allowance: "1" } }, invoice.core_account)).not.toThrow();
  });
  it.each(["FullAccess", { GasKeyFullAccess: { balance: "10" } }, { FunctionCall: { receiver_id: "other.testnet", method_names: ["execute_payment"], allowance: "1" } },
    { FunctionCall: { receiver_id: invoice.core_account, method_names: [], allowance: "1" } }, { FunctionCall: { receiver_id: invoice.core_account, method_names: ["execute_payment", "set_policy"], allowance: "1" } },
    { FunctionCall: { receiver_id: invoice.core_account, method_names: ["execute_payment"], allowance: null } }, { FunctionCall: { receiver_id: invoice.core_account, method_names: ["execute_payment"], allowance: "0" } }])("rejects unsafe permission %#", (value) => {
    expect(() => assertRestrictedWorkerKey(value, invoice.core_account)).toThrow("UNSAFE_WORKER_KEY");
  });
});

import { afterEach, vi } from "vitest";
import { KeyPair, KeyPairSigner, baseEncode, SignedTransaction } from "near-api-js";
import { AgentTrustClient } from "../src/client.js";
import type { ExecutePaymentArgs } from "../src/views.js";
const quoteArgs: ExecutePaymentArgs = { quote: { invoice, signature: Buffer.alloc(64).toString("base64") }, credential: null };
const rpcBlock = baseEncode(Buffer.alloc(32, 3));
function mockRpc(overrides: (method: string, params: Record<string, unknown>) => unknown | undefined = () => undefined) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(init!.body as string) as { id: string; method: string; params: Record<string, unknown> };
    calls.push(request);
    let result = overrides(request.method, request.params);
    if (result === undefined) {
      if (request.method === "status") result = { chain_id: "testnet" };
      else if (request.method === "block") result = { header: { hash: rpcBlock } };
      else if (request.method === "query" && request.params.request_type === "view_access_key") result = { nonce: 0, permission: { FunctionCall: { receiver_id: invoice.core_account, method_names: ["execute_payment"], allowance: "1000000000000000000000000" } }, block_hash: rpcBlock, block_height: 20 };
      else if (request.method === "query") {
        let value: unknown;
        switch (request.params.method_name) {
          case "get_config": value = { network: "near:testnet", core_account: invoice.core_account, operating_reserve_yocto: "1" }; break;
          case "get_payment": value = payment(); break;
          case "preview_payment": value = { authorization: "not_proven_by_view", decision: { kind: "allow" } }; break;
          case "list_services": value = { items: [service()], next_cursor: null }; break;
          default: throw new Error(`Unhandled view ${request.params.method_name}`);
        }
        result = { result: [...Buffer.from(JSON.stringify(value))], block_hash: rpcBlock, block_height: 20, logs: [] };
      } else if (request.method === "send_tx") result = { final_execution_status: "INCLUDED" };
      else if (request.method === "EXPERIMENTAL_tx_status") result = { final_execution_status: "INCLUDED" };
      else throw new Error(`Unhandled method ${request.method}`);
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, calls };
}
const client = (worker = false) => new AgentTrustClient({ network: "near:testnet", coreAccount: invoice.core_account, rpcUrl: "https://rpc.example", catalog: [{ service_id: invoice.service_id, service_version: invoice.service_version, origin }],
  ...(worker ? { worker: { ownerId: invoice.owner_id, signer: new KeyPairSigner(KeyPair.fromRandom("ed25519")) } } : {}) });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("source-wired native client", () => {
  it("reads final contract state with block reference without a worker or key query", async () => {
    const { calls } = mockRpc();
    const snapshot = await client().getPaymentSnapshot(invoice.owner_id, invoice.payment_id);
    expect(snapshot.value).toEqual(payment());
    expect(snapshot.block).toEqual({ finality: "final", block_hash: rpcBlock, block_height: 20 });
    expect(calls.every((c) => c.method !== "query" || c.params.finality === "final")).toBe(true);
    expect(calls.some((c) => c.params.request_type === "view_access_key")).toBe(false);
  });
  it("network or contract-domain mismatch prevents reads and broadcasts", async () => {
    const { calls } = mockRpc((method) => method === "status" ? { chain_id: "mainnet" } : undefined);
    await expect(client(true).executePayment(quoteArgs)).rejects.toThrow("DOMAIN_MISMATCH");
    expect(calls.some((c) => c.method === "send_tx")).toBe(false);
  });
  it("preserves the no-key-possession preview label and refuses a forged label", async () => {
    const { calls } = mockRpc();
    expect(await client().previewPayment(quoteArgs)).toEqual({ authorization: "not_proven_by_view", decision: { kind: "allow" } });
    expect(calls.every((c) => c.method === "status" || c.method === "query")).toBe(true);
    mockRpc((method, params) => method === "query" && params.method_name === "preview_payment" ? { result: [...Buffer.from(JSON.stringify({ authorization: "proven", decision: { kind: "allow" } }))], block_hash: rpcBlock, block_height: 20 } : undefined);
    await expect(client().previewPayment(quoteArgs)).rejects.toThrow("INVALID_PREVIEW");
  });
  it("labels configured registry membership without implying policy eligibility", async () => {
    mockRpc();
    expect((await client().listServices()).items[0]).toMatchObject({ registered: true, configured: true, eligibility: "not_evaluated" });
    for (const limit of [0, 21, 1.5]) await expect(client().listServices(null, limit)).rejects.toThrow("INVALID_PAGE_LIMIT");
    await expect(client().listServices("01", 2)).rejects.toThrow();
  });
  it("final not-found after a previous broadcast remains uncertain", async () => {
    mockRpc((method, params) => method === "query" && params.method_name === "get_payment" ? { result: [...Buffer.from("null")], block_hash: rpcBlock, block_height: 20 } : undefined);
    expect(await client().awaitPayment(invoice.owner_id, invoice.payment_id, 0)).toMatchObject({ kind: "uncertain", reason: "not_found", payment_id: invoice.payment_id });
  });
  it("journal checkpoint failure prevents broadcast and exposes the precomputed locator", async () => {
    const { calls } = mockRpc();
    let locator: TransactionLocator | undefined;
    await expect(client(true).executePayment(quoteArgs, { beforeBroadcast: async (value) => { locator = value; throw new Error("journal fsync failed"); } })).rejects.toThrow("journal fsync failed");
    expect(locator?.sender_account_id).toBe(invoice.owner_id);
    expect(locator?.tx_hash).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(calls.some((c) => c.method === "send_tx")).toBe(false);
  });
  it("broadcasts exactly one zero-deposit core execute action and retains its ID when RPC response is lost", async () => {
    const { calls } = mockRpc((method) => { if (method === "send_tx") throw new Error("response lost"); return undefined; });
    const result = await client(true).executePayment(quoteArgs);
    expect(result).toMatchObject({ kind: "uncertain", reason: "broadcast_or_rpc_error", transaction: { sender_account_id: invoice.owner_id } });
    const sent = calls.filter((c) => c.method === "send_tx");
    expect(sent).toHaveLength(1);
    const signed = SignedTransaction.decode(Buffer.from(sent[0]!.params.signed_tx_base64 as string, "base64"));
    expect(signed.transaction.receiverId).toBe(invoice.core_account);
    expect(signed.transaction.actions).toHaveLength(1);
    const action = signed.transaction.actions[0]!.functionCall!;
    expect(action.methodName).toBe("execute_payment"); expect(action.deposit).toBe(0n);
    expect(JSON.parse(Buffer.from(action.args).toString())).toEqual(quoteArgs);
  });
  it("full-access keys stop before signing or sending", async () => {
    const { calls } = mockRpc((method, params) => method === "query" && params.request_type === "view_access_key" ? { nonce: 0, permission: "FullAccess", block_hash: rpcBlock, block_height: 20 } : undefined);
    await expect(client(true).executePayment(quoteArgs)).rejects.toThrow("UNSAFE_WORKER_KEY");
    expect(calls.some((c) => c.method === "send_tx")).toBe(false);
  });
});

describe("submission and recovery boundaries", () => {
  it("requests FINAL receipt status, binds returned call arguments, and still reports Pending admission", async () => {
    let sentArgs: unknown;
    const { calls } = mockRpc((method, params) => {
      if (method === "send_tx") {
        const tx = SignedTransaction.decode(Buffer.from(params.signed_tx_base64 as string, "base64"));
        sentArgs = JSON.parse(Buffer.from(tx.transaction.actions[0]!.functionCall!.args).toString());
        return { final_execution_status: "INCLUDED" };
      }
      if (method === "EXPERIMENTAL_tx_status") {
        const raw = rawResult(); raw.transaction.hash = params.tx_hash as string;
        raw.transaction.actions[0]!.FunctionCall.args = Buffer.from(JSON.stringify(sentArgs)).toString("base64");
        return raw;
      }
      return undefined;
    });
    const result = await client(true).executePayment(quoteArgs);
    expect(result).toMatchObject({ kind: "final", admission: { kind: "payment", payment: { state: "pending" } }, receipt_ids: ["receipt"] });
    expect(calls.find((c) => c.method === "EXPERIMENTAL_tx_status")?.params.wait_until).toBe("FINAL");
    expect(calls.filter((c) => c.method === "send_tx")).toHaveLength(1);
  });
  it("snapshots the exact quote before asynchronous signing/checkpoint work", async () => {
    const { calls } = mockRpc();
    const args = structuredClone(quoteArgs);
    await client(true).executePayment(args, { beforeBroadcast: async () => { args.quote.invoice.amount_yocto = "2"; } });
    const sent = calls.find((c) => c.method === "send_tx")!;
    const tx = SignedTransaction.decode(Buffer.from(sent.params.signed_tx_base64 as string, "base64"));
    expect(JSON.parse(Buffer.from(tx.transaction.actions[0]!.functionCall!.args).toString())).toEqual(quoteArgs);
  });
  it("pending reconciliation remains reserved and unknown rather than failed", async () => {
    const pending = { ...payment("pending"), display_state: "needs_reconciliation" };
    mockRpc((method, params) => method === "query" && params.method_name === "get_payment" ? { result: [...Buffer.from(JSON.stringify(pending))], block_hash: rpcBlock, block_height: 20 } : undefined);
    expect(await client().awaitPayment(invoice.owner_id, invoice.payment_id, 0)).toMatchObject({ kind: "uncertain", reason: "pending", payment: { state: "pending", display_state: "needs_reconciliation" } });
  });
  it("rejects a mismatched core identity and oversized server pagination", async () => {
    mockRpc((method, params) => method === "query" && params.method_name === "get_config" ? { result: [...Buffer.from(JSON.stringify({ network: "near:testnet", core_account: "other.testnet", operating_reserve_yocto: "1" }))], block_hash: rpcBlock, block_height: 20 } : undefined);
    await expect(client().getPayment(invoice.owner_id, invoice.payment_id)).rejects.toThrow("DOMAIN_MISMATCH");
    mockRpc((method, params) => method === "query" && params.method_name === "list_services" ? { result: [...Buffer.from(JSON.stringify({ items: [service(), service()], next_cursor: null }))], block_hash: rpcBlock, block_height: 20 } : undefined);
    await expect(client().listServices(null, 1)).rejects.toThrow("INVALID_PAGE");
  });
});

describe("recovery binds the exact submitted signature and credential", () => {
  const reference = { issuer_id: "issuer.testnet", credential_id: Buffer.alloc(32, 7).toString("base64"), revision: 3 };
  const expectedWithCredential: ExecutePaymentArgs = { ...quoteArgs, credential: reference };
  function responseFor(submitted: unknown, returned: ExecutionResult = { kind: "rejected", decision: { kind: "deny", code: "INVALID_INVOICE" } }) {
    const raw = rawResult();
    raw.transaction.actions[0]!.FunctionCall.args = Buffer.from(JSON.stringify(submitted)).toString("base64");
    const encoded = Buffer.from(JSON.stringify(returned)).toString("base64");
    raw.status.SuccessValue = encoded;
    raw.receipts_outcome[0]!.outcome.status.SuccessValue = encoded;
    return raw;
  }
  it.each([
    { label: "changed signature", expected: quoteArgs, submitted: { ...quoteArgs, quote: { ...quoteArgs.quote, signature: Buffer.alloc(64, 1).toString("base64") } } },
    { label: "omitted credential", expected: quoteArgs, submitted: { quote: quoteArgs.quote } },
    { label: "unexpected credential", expected: quoteArgs, submitted: expectedWithCredential },
    { label: "removed credential", expected: expectedWithCredential, submitted: quoteArgs },
    { label: "changed issuer", expected: expectedWithCredential, submitted: { ...expectedWithCredential, credential: { ...reference, issuer_id: "other.testnet" } } },
    { label: "changed credential ID", expected: expectedWithCredential, submitted: { ...expectedWithCredential, credential: { ...reference, credential_id: Buffer.alloc(32, 8).toString("base64") } } },
    { label: "changed credential revision", expected: expectedWithCredential, submitted: { ...expectedWithCredential, credential: { ...reference, revision: 4 } } },
  ])("keeps a final rejection uncertain for $label", async ({ expected, submitted }) => {
    mockRpc((method) => method === "EXPERIMENTAL_tx_status" ? responseFor(submitted) : undefined);
    expect(await client().resolveSubmission(locator, expected)).toEqual({ kind: "uncertain", transaction: locator, reason: "unresolved_execution" });
  });
  it("accepts matching submitted fields independent of JSON property order", async () => {
    const reordered = { credential: { revision: reference.revision, credential_id: reference.credential_id, issuer_id: reference.issuer_id }, quote: { signature: quoteArgs.quote.signature, invoice: quoteArgs.quote.invoice } };
    mockRpc((method) => method === "EXPERIMENTAL_tx_status" ? responseFor(reordered) : undefined);
    expect(await client().resolveSubmission(locator, expectedWithCredential)).toMatchObject({ kind: "final", admission: { kind: "rejected", decision: { code: "INVALID_INVOICE" } } });
  });
  it("preserves original returned credential evidence on an exact invoice retry", async () => {
    const originalReference = { ...reference, revision: 1 };
    const originalPayment = { ...payment(), credential: originalReference };
    mockRpc((method) => method === "EXPERIMENTAL_tx_status" ? responseFor(expectedWithCredential, { kind: "payment", duplicate: true, payment: originalPayment }) : undefined);
    expect(await client().resolveSubmission(locator, expectedWithCredential)).toMatchObject({ kind: "final", admission: { kind: "payment", duplicate: true, payment: { credential: originalReference } } });
  });
});
