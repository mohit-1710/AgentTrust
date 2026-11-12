import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readDecisions } from "../../web/lib/near/server.js";
import { accountUrl, formatNear, paymentLabel, transactionUrl } from "../../web/lib/near/format.js";
import { invoiceHash } from "../../packages/near-sdk/src/codec.js";
import type { InvoiceV1 } from "../../packages/near-sdk/src/types.js";
import type { PaymentView } from "../../packages/near-sdk/src/views.js";

const invoice = JSON.parse(readFileSync(new URL("../../fixtures/protocol/v1/vectors.json", import.meta.url), "utf8")).invoices[0].input as InvoiceV1;
const env = {
  AGENTTRUST_NEAR_RPC_URL: "https://rpc.example",
  AGENTTRUST_NEAR_CORE_ACCOUNT: invoice.core_account,
  AGENTTRUST_NEAR_OWNER_ID: invoice.owner_id,
};
const payment = (state: PaymentView["state"] = "pending"): PaymentView => ({ invoice, invoice_hash: invoiceHash(invoice), credential: null,
  dispatched_at_ns: "1000", dispatch_day: "0", dispatch_minute: "0", state, display_state: state, finalized_at_ns: state === "pending" ? "0" : "2000" });
function rpc(options: { chain?: string; core?: string; records?: unknown[]; cursor?: string | null; receipt?: unknown; broken?: boolean } = {}) {
  const calls: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    const call = JSON.parse(init.body as string); calls.push(call);
    if (options.broken) throw new Error("provider error with sensitive internal detail");
    let result: unknown;
    if (call.method === "status") result = { chain_id: options.chain ?? "testnet" };
    else if (call.method === "EXPERIMENTAL_tx_status") result = options.receipt;
    else if (call.method === "query") {
      const value = call.params.method_name === "get_config"
        ? { network: "near:testnet", core_account: options.core ?? invoice.core_account, operating_reserve_yocto: "0" }
        : { items: options.records ?? [payment()], next_cursor: options.cursor ?? null };
      result = { result: [...Buffer.from(JSON.stringify(value))], block_hash: "block-hash", block_height: 20 };
    } else throw new Error("Unexpected method: " + call.method);
    return Response.json({ jsonrpc: "2.0", id: call.id, result });
  }));
  return calls;
}
const tx = { tx_hash: "11111111111111111111111111111111", sender_account_id: invoice.owner_id };
function rejection() {
  const args = { quote: { invoice, signature: Buffer.alloc(64).toString("base64") }, credential: null };
  const value = Buffer.from(JSON.stringify({ kind: "rejected", decision: { kind: "deny", code: "DAILY_CAP" } })).toString("base64");
  return { final_execution_status: "FINAL", transaction: { hash: tx.tx_hash, signer_id: tx.sender_account_id, receiver_id: invoice.core_account,
    actions: [{ FunctionCall: { method_name: "execute_payment", deposit: "0", args: Buffer.from(JSON.stringify(args)).toString("base64") } }] },
    status: { SuccessValue: value }, receipts_outcome: [{ id: "core-receipt", outcome: { executor_id: invoice.core_account, status: { SuccessValue: value } } }] };
}
afterEach(() => vi.unstubAllGlobals());

describe("NEAR decisions formatter", () => {
  it.each([
    ["0", "0 NEAR"], ["1", "0.000000000000000000000001 NEAR"],
    ["1000000000000000000000000", "1 NEAR"], ["30000000000000000000000", "0.03 NEAR"],
    ["340282366920938463463374607431768211455", "340282366920938.463463374607431768211455 NEAR"],
  ])("formats exact native value %s without floats", (value, expected) => expect(formatNear(value)).toBe(expected));
  it.each(["-1", "01", "1.1", "1e24", "340282366920938463463374607431768211456"])("rejects invalid native amount %s", (value) => expect(() => formatNear(value)).toThrow());
  it("links only to fixed testnet explorer paths", () => {
    expect(accountUrl("audit.testnet")).toBe("https://testnet.nearblocks.io/address/audit.testnet");
    expect(transactionUrl(tx.tx_hash)).toBe("https://testnet.nearblocks.io/txns/" + tx.tx_hash);
    expect(() => accountUrl("https://evil.example")).toThrow();
    expect(() => transactionUrl("javascript:bad")).toThrow();
  });
  it("never promotes pending or reconciliation to settlement", () => {
    expect(paymentLabel(payment())).toBe("PENDING");
    expect(paymentLabel({ state: "pending", display_state: "needs_reconciliation" })).toBe("RECONCILIATION");
    expect(paymentLabel(payment("settled"))).toBe("SETTLED");
    expect(paymentLabel(payment("failed"))).toBe("FAILED");
  });
});

describe("read-only NEAR decisions adapter", () => {
  it("returns honest unconfigured state without any RPC", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await readDecisions(new URLSearchParams(), {})).toEqual({ status: 200, body: { kind: "unconfigured" } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects partial/invalid operator configuration before RPC and never exposes it", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const config of [{ AGENTTRUST_NEAR_OWNER_ID: "alice.testnet" }, { ...env, AGENTTRUST_NEAR_RPC_URL: "https://secret:password@rpc.example" }, { ...env, AGENTTRUST_NEAR_OWNER_ID: "invalid owner" }]) {
      expect(await readDecisions(new URLSearchParams(), config)).toEqual({ status: 503, body: { kind: "error", code: "INVALID_CONFIGURATION" } });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["owner_id=other.testnet", "rpc_url=https://evil.example", "limit=21", "cursor=-1", "cursor=01", "cursor=129", "cursor=1&cursor=2"])("rejects query %s without arbitrary target/paging", async (query) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await readDecisions(new URLSearchParams(query), env)).toEqual({ status: 400, body: { kind: "error", code: "INVALID_QUERY" } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses actual SDK final views, exact configured owner, and bounded cursor", async () => {
    const calls = rpc({ cursor: "8" });
    const response = await readDecisions(new URLSearchParams("cursor=28"), env);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ kind: "ready", origin: "final_contract_view", owner_id: invoice.owner_id,
      network: "near:testnet", page: { items: [payment()], next_cursor: "8" }, rejections: [], unresolved_references: 0 });
    expect(calls.map((c) => c.method).sort()).toEqual(["query", "query", "status"]);
    for (const call of calls.filter((c) => c.method === "query")) {
      expect(call.params).toMatchObject({ finality: "final", account_id: invoice.core_account });
    }
    const last = calls.find((c) => (c.params as { method_name?: string })?.method_name === "list_recent_payments")!;
    expect(JSON.parse(Buffer.from((last.params as { args_base64: string }).args_base64, "base64").toString())).toEqual({ owner_id: invoice.owner_id, cursor: "28", limit: 20 });
    expect(JSON.stringify(response.body)).not.toContain(env.AGENTTRUST_NEAR_RPC_URL);
  });
  it.each([{ chain: "mainnet" }, { core: "other.testnet" }])("domain mismatch is an error, never empty history", async (options) => {
    rpc(options);
    expect(await readDecisions(new URLSearchParams(), env)).toEqual({ status: 503, body: { kind: "error", code: "DOMAIN_MISMATCH" } });
  });
  it("rejects malformed or foreign payment records through actual SDK validation", async () => {
    for (const records of [[{ ...payment(), invoice_hash: Buffer.alloc(32).toString("base64") }], [{ ...payment(), invoice: { ...invoice, owner_id: "other.testnet" } }], Array(21).fill(payment())]) {
      rpc({ records });
      expect((await readDecisions(new URLSearchParams(), env)).body.kind).toBe("error");
    }
  });
  it("keeps real empty history distinct from RPC failure and strips provider detail", async () => {
    rpc({ records: [] });
    expect((await readDecisions(new URLSearchParams(), env)).body).toMatchObject({ kind: "ready", page: { items: [] } });
    rpc({ broken: true });
    expect(await readDecisions(new URLSearchParams(), env)).toEqual({ status: 503, body: { kind: "error", code: "RPC_UNAVAILABLE" } });
  });
  it("exposes a rejection only from a configured final matching successful core response", async () => {
    const calls = rpc({ receipt: rejection() });
    const response = await readDecisions(new URLSearchParams(), { ...env, AGENTTRUST_NEAR_DECISION_REFS: JSON.stringify([tx]) });
    expect(response.body).toMatchObject({ kind: "ready", unresolved_references: 0, rejections: [{ origin: "executed_rejection", invoice,
      decision: { kind: "deny", code: "DAILY_CAP" }, transaction: tx, receipt_ids: ["core-receipt"] }] });
    expect(calls.find((c) => c.method === "EXPERIMENTAL_tx_status")!.params).toMatchObject({ ...tx, wait_until: "FINAL" });
  });
  it("projects only public evidence fields and keeps the submitted credential reference", async () => {
    const record = { ...payment(), private_key: "do-not-expose", credential: { issuer_id: "issuer.testnet", credential_id: Buffer.alloc(32, 4).toString("base64"), revision: 1, report: "private-report" } };
    const raw = rejection();
    const credential = { issuer_id: "issuer.testnet", credential_id: Buffer.alloc(32, 5).toString("base64"), revision: 2 };
    raw.transaction.actions[0]!.FunctionCall.args = Buffer.from(JSON.stringify({ quote: { invoice, signature: Buffer.alloc(64).toString("base64") }, credential })).toString("base64");
    const value = Buffer.from(JSON.stringify({ kind: "rejected", decision: { kind: "deny", code: "DAILY_CAP", csv_utf8: "private-csv" } })).toString("base64");
    raw.status.SuccessValue = value;
    raw.receipts_outcome[0]!.outcome.status.SuccessValue = value;
    rpc({ records: [record], receipt: raw });
    const response = await readDecisions(new URLSearchParams(), { ...env, AGENTTRUST_NEAR_DECISION_REFS: JSON.stringify([tx]) });
    expect(response.body).toMatchObject({ kind: "ready", rejections: [{ invoice_hash: invoiceHash(invoice), credential }] });
    expect(JSON.stringify(response.body)).not.toMatch(/private_key|do-not-expose|private-report|private-csv|csv_utf8/);
  });
  it("never renders optimistic, foreign or failed-receipt rejection evidence as final", async () => {
    for (const raw of [
      { ...rejection(), final_execution_status: "INCLUDED" },
      { ...rejection(), transaction: { ...rejection().transaction, receiver_id: "other.testnet" } },
      { ...rejection(), receipts_outcome: [{ id: "failed-receipt", outcome: { executor_id: invoice.core_account, status: { Failure: {} } } }] },
    ]) {
      rpc({ receipt: raw });
      expect((await readDecisions(new URLSearchParams(), { ...env, AGENTTRUST_NEAR_DECISION_REFS: JSON.stringify([tx]) })).body)
        .toMatchObject({ kind: "ready", rejections: [], unresolved_references: 1 });
    }
  });
  it("does not label another asset/schema/network request as a native NEAR rejected payment", async () => {
    for (const changed of [{ asset: "OTHER" }, { schema_version: 2 }, { network: "near:mainnet" }]) {
      const raw = rejection();
      raw.transaction.actions[0]!.FunctionCall.args = Buffer.from(JSON.stringify({
        quote: { invoice: { ...invoice, ...changed }, signature: Buffer.alloc(64).toString("base64") }, credential: null,
      })).toString("base64");
      rpc({ receipt: raw });
      expect((await readDecisions(new URLSearchParams(), { ...env, AGENTTRUST_NEAR_DECISION_REFS: JSON.stringify([tx]) })).body)
        .toMatchObject({ kind: "ready", rejections: [], unresolved_references: 1 });
    }
  });
  it("bounds and validates configured receipt references; older pages do not repeat them", async () => {
    for (const refs of [Array(9).fill(tx), [tx, tx], [{ ...tx, sender_account_id: "other.testnet" }], [{ ...tx, tx_hash: "bad hash" }]]) {
      const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
      expect((await readDecisions(new URLSearchParams(), { ...env, AGENTTRUST_NEAR_DECISION_REFS: JSON.stringify(refs) })).body)
        .toEqual({ kind: "error", code: "INVALID_CONFIGURATION" });
      expect(fetcher).not.toHaveBeenCalled();
    }
    const calls = rpc();
    expect((await readDecisions(new URLSearchParams("cursor=4"), { ...env, AGENTTRUST_NEAR_DECISION_REFS: JSON.stringify([tx]) })).body)
      .toMatchObject({ kind: "ready", rejections: [], unresolved_references: 0 });
    expect(calls.some((call) => call.method === "EXPERIMENTAL_tx_status")).toBe(false);
  });
});
