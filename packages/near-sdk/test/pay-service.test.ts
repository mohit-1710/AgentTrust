import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTrustClient, type BroadcastOptions } from "../src/client.js";
import { AttemptJournal } from "../src/attempts.js";
import { invoiceHash } from "../src/codec.js";
import type { ExecutePaymentArgs, PaymentView, SubmissionResult } from "../src/views.js";
import { createAuditHandler } from "../../../examples/invoice-audit/src/server.js";
import { block, context, csv, hash, now, origin, payment, quote, service, signBytes, transaction } from "../../../examples/invoice-audit/test/paid-fixtures.js";

const paths: string[] = [];
beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(Number(now / 1_000_000n)); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(paths.splice(0).map((path) => fs.rm(path, { recursive: true, force: true }))); });
async function setup() {
  const directory = await fs.mkdtemp(join(tmpdir(), "agenttrust-purchase-")); paths.push(directory);
  const options = { network: "near:testnet" as const, coreAccount: "core.testnet", rpcUrl: "https://rpc.example", catalog: [{ service_id: service.service_id, service_version: 1, origin }], purchase: { ownerId: context.owner_id, sessionId: context.session_id, attemptsDirectory: join(await fs.realpath(directory), "attempts"), waitTimeoutMs: 0 } };
  const client = new AgentTrustClient(options);
  let record: PaymentView | null = null, submitted: ExecutePaymentArgs | null = null, broadcasts = 0, providerReads = 0;
  const urls: string[] = [];
  const submission = (): SubmissionResult => record && submitted ? { kind: "final", transaction, receipt_ids: ["receipt"], admission: { kind: "payment", payment: payment(submitted.quote, "pending"), duplicate: false } } : { kind: "uncertain", transaction, reason: "not_final" };
  const reader = { network: "near:testnet" as const, coreAccount: "core.testnet", getPaymentSnapshot: async () => { providerReads++; return { value: record, block }; }, resolveSubmission: async () => { providerReads++; return submission(); } };
  const handler = createAuditHandler({ network: "near:testnet", core_account: "core.testnet", offer: { service, origin, amount_yocto: "10" }, sign: signBytes, nowNs: () => BigInt(Date.now()) * 1_000_000n, reader });
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => { urls.push(String(url)); return handler(new Request(String(url), init)); });
  vi.stubGlobal("fetch", fetcher);
  const getService = vi.spyOn(client, "getService").mockResolvedValue(service);
  vi.spyOn(client, "getPolicy").mockResolvedValue({ owner_id: context.owner_id, revision: 1, paused: false, daily_cap_yocto: "100", max_dispatches_per_minute: 10, trusted_services: [], blocked_services: [], blocked_payouts: [] });
  vi.spyOn(client, "getSession").mockResolvedValue({ owner_id: context.owner_id, session_id: context.session_id, public_key: "ed25519:test", profile_id: "audit", profile_revision: 1, purchase_cap_yocto: "100", expires_at_ns: (now + 600_000_000_000n).toString(), revoked: false });
  vi.spyOn(client, "getPaymentSnapshot").mockImplementation(async () => ({ value: record, block }));
  const preview = vi.spyOn(client, "previewPayment").mockResolvedValue({ authorization: "not_proven_by_view", decision: { kind: "allow" } });
  const execute = vi.spyOn(client, "executePayment").mockImplementation(async (args, hooks) => {
    await hooks?.beforeBroadcast?.(transaction); broadcasts++; submitted = structuredClone(args); record = payment(args.quote); return submission();
  });
  const resolve = vi.spyOn(client, "resolveSubmission").mockImplementation(async () => submission());
  vi.spyOn(client, "awaitPayment").mockImplementation(async () => record?.state === "settled" || record?.state === "failed" ? { kind: record.state, payment: record, block } : { kind: "uncertain", owner_id: context.owner_id, payment_id: context.payment_id, reason: record ? "pending" : "not_found", ...(record ? { payment: record, block } : {}) });
  return { client, options, execute, resolve, preview, fetcher, urls, getService, directory, args: { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id },
    get broadcasts() { return broadcasts; }, get providerReads() { return providerReads; }, get submitted() { return submitted; },
    setRecord(value: PaymentView | null) { record = value; }, setSubmitted(value: ExecutePaymentArgs) { submitted = value; },
    async broadcast(args: ExecutePaymentArgs, hooks?: BroadcastOptions) { await hooks?.beforeBroadcast?.(transaction); broadcasts++; submitted = structuredClone(args); },
  };
}

describe("paid audit exact-attempt workflow", () => {
  it("pays once and returns independently checked real output plus final evidence", async () => {
    const s = await setup(); const result = await s.client.payService(s.args);
    expect(result.kind).toBe("paid"); expect(s.broadcasts).toBe(1); expect(s.providerReads).toBe(2);
    if (result.kind !== "paid") throw new Error("not paid");
    expect(result.report.currency_totals).toEqual([{ currency: "USD", amount: "6.00", row_count: 2 }]);
    expect(result.output_check).toEqual({ ok: true }); expect(result.receipt_ids).toEqual(["receipt"]);
    expect(s.fetcher.mock.calls.every(([, init]) => init?.redirect === "error")).toBe(true);
    const files = await fs.readdir(s.options.purchase.attemptsDirectory); expect(files).toHaveLength(2);
    for (const file of files) expect(await fs.readFile(join(s.options.purchase.attemptsDirectory, file), "utf8")).not.toContain(csv);
  });
  it("rejects a forged signed quote before broadcast", async () => {
    const s = await setup(); s.fetcher.mockResolvedValueOnce(Response.json({ protocol: "agenttrust-http402-v1", quote: { ...quote(), signature: Buffer.alloc(64).toString("base64") } }, { status: 402 }));
    await expect(s.client.payService(s.args)).rejects.toThrow("INVALID_QUOTE"); expect(s.broadcasts).toBe(0);
  });
  it("rejects redirects and non-JSON quote responses before any payment", async () => {
    const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://other.example" } }));
    await expect(s.client.payService(s.args)).rejects.toThrow("HTTP_REDIRECT");
    s.fetcher.mockResolvedValueOnce(new Response("{}", { status: 402 }));
    await expect(s.client.payService(s.args)).rejects.toThrow("HTTP_RESPONSE_INVALID"); expect(s.broadcasts).toBe(0);
  });
  it.each([{ owner_id: "other.testnet" }, { core_account: "other.testnet" }, { payout_account: "other.testnet" }, { request_hash: hash(7) }, { session_id: hash(8) }, { policy_revision: 2 }, { profile_revision: 2 }, { service_version: 2 }])("rejects a signed but mismatched quote %j", async (change) => {
    const s = await setup(); s.fetcher.mockResolvedValueOnce(Response.json({ protocol: "agenttrust-http402-v1", quote: quote(change) }, { status: 402 }));
    await expect(s.client.payService(s.args)).rejects.toThrow("INVALID_QUOTE"); expect(s.broadcasts).toBe(0);
  });
  it("reloads exact saved quote after a lost broadcast response and later retrieves without resubmitting", async () => {
    const s = await setup(); s.execute.mockImplementationOnce(async (args, hooks) => { await s.broadcast(args, hooks); throw new Error("lost response after send"); });
    expect((await s.client.payService(s.args)).kind).toBe("uncertain");
    const original = structuredClone(s.submitted!); s.setRecord(payment(original.quote));
    expect((await s.client.payService(s.args)).kind).toBe("paid"); expect(s.execute).toHaveBeenCalledTimes(1); expect(s.broadcasts).toBe(1);
    expect(s.resolve.mock.calls.every(([, args]) => JSON.stringify(args) === JSON.stringify(original))).toBe(true);
    expect(s.urls).toHaveLength(2); // One quote and one redemption.
  });
  it("unknown plus not-found stays uncertain across expiry and never asks for a replacement quote or ID", async () => {
    const s = await setup(); s.execute.mockImplementationOnce(async (args, hooks) => { await s.broadcast(args, hooks); return { kind: "uncertain", transaction, reason: "broadcast_or_rpc_error" }; });
    expect((await s.client.payService(s.args)).kind).toBe("uncertain");
    vi.spyOn(Date, "now").mockReturnValue(Number(now / 1_000_000n) + 600_000);
    s.execute.mockResolvedValue({ kind: "final", transaction, receipt_ids: ["later-rejection"], admission: { kind: "rejected", decision: { kind: "deny", code: "RATE_LIMIT" } } });
    expect((await s.client.payService(s.args)).kind).toBe("uncertain"); expect(s.execute).toHaveBeenCalledTimes(1); expect(s.urls).toHaveLength(1); expect(s.broadcasts).toBe(1);
  });
  it.each(["csvUtf8", "serviceId"] as const)("rejects an existing ID used with different %s", async (field) => {
    const s = await setup(); await s.client.payService(s.args);
    await expect(s.client.payService({ ...s.args, [field]: field === "csvUtf8" ? csv + "v2,i2,1,USD\n" : "other.testnet" })).rejects.toThrow("ATTEMPT_CONFLICT");
    expect(s.broadcasts).toBe(1); expect(s.urls).toHaveLength(2);
  });
  it("checkpoint durability failure stops the broadcast", async () => {
    const s = await setup(); vi.spyOn(AttemptJournal.prototype, "claim").mockRejectedValue(new Error("disk failed"));
    await expect(s.client.payService(s.args)).rejects.toThrow("disk failed"); expect(s.broadcasts).toBe(0);
  });
  it("settled original content remains retrievable after expiry and registry rotation", async () => {
    const s = await setup(); await s.client.payService(s.args);
    vi.spyOn(Date, "now").mockReturnValue(Number(now / 1_000_000n) + 600_000);
    s.getService.mockResolvedValue({ ...service, version: 2, payout_account: "new.testnet" });
    expect((await s.client.payService(s.args)).kind).toBe("paid"); expect(s.getService).toHaveBeenCalledTimes(1); expect(s.broadcasts).toBe(1);
  });
  it("retrieval or output-check failure never converts a settled payment into a new purchase", async () => {
    const s = await setup(); const base = s.fetcher.getMockImplementation()!;
    s.fetcher.mockImplementation(async (url, init) => {
      const response = await base(url, init);
      if (response.status === 200) { const body = await response.json(); body.report.currency_totals[0].amount = "99.00"; return Response.json(body); }
      return response;
    });
    expect((await s.client.payService(s.args)).kind).toBe("retrieval_failed");
    s.fetcher.mockImplementation(base); expect((await s.client.payService(s.args)).kind).toBe("paid"); expect(s.broadcasts).toBe(1);
  });
  it("a preview refusal has no invented transaction and reserves the no-broadcast decision", async () => {
    const s = await setup(); s.preview.mockResolvedValue({ authorization: "not_proven_by_view", decision: { kind: "deny", code: "UNKNOWN_SERVICE" } });
    const result = await s.client.payService(s.args); expect(result).toEqual({ kind: "denied", origin: "preview", payment_id: context.payment_id, decision: { kind: "deny", code: "UNKNOWN_SERVICE" } });
    s.preview.mockResolvedValue({ authorization: "not_proven_by_view", decision: { kind: "allow" } });
    expect(await s.client.payService(s.args)).toEqual({ ...result, origin: "recorded_replay", original_origin: "preview" }); expect(s.execute).not.toHaveBeenCalled();
  });
  it("concurrent callers converge on one saved quote and only one broadcast", async () => {
    const s = await setup(); const results = await Promise.all(Array.from({ length: 8 }, () => s.client.payService(s.args)));
    expect(results.every((result) => ["paid", "uncertain"].includes(result.kind))).toBe(true); expect(s.broadcasts).toBe(1);
    expect(new Set(s.execute.mock.calls.map(([args]) => invoiceHash(args.quote.invoice))).size).toBe(1);
  });
  it("a concurrent preview refusal cannot declare no dispatch while another caller can still send", async () => {
    const s = await setup(); let release!: () => void, signingStarted!: () => void;
    const signing = new Promise<void>((resolve) => { signingStarted = resolve; });
    const releaseSigning = new Promise<void>((resolve) => { release = resolve; });
    s.execute.mockImplementationOnce(async (args, hooks) => { signingStarted(); await releaseSigning; await s.broadcast(args, hooks); return { kind: "uncertain", transaction, reason: "not_final" }; });
    const first = s.client.payService(s.args); await signing;
    s.preview.mockResolvedValue({ authorization: "not_proven_by_view", decision: { kind: "deny", code: "RATE_LIMIT" } });
    const second = await s.client.payService(s.args); expect(second.kind).toBe("denied");
    release(); expect(await first).toEqual({ ...second, origin: "recorded_replay", original_origin: "preview" }); expect(s.broadcasts).toBe(0);
  });
  it("a crash after checkpoint but before send remains uncertain and does not rebroadcast", async () => {
    const s = await setup(); s.execute.mockImplementationOnce(async (_args, hooks) => { await hooks?.beforeBroadcast?.(transaction); throw new Error("process stopped before send"); });
    expect((await s.client.payService(s.args)).kind).toBe("uncertain");
    expect((await s.client.payService(s.args)).kind).toBe("uncertain"); expect(s.broadcasts).toBe(0); expect(s.execute).toHaveBeenCalledTimes(1);
  });
  it("pending and failed payments never release output or trigger another payment", async () => {
    const s = await setup(); s.execute.mockImplementationOnce(async (args, hooks) => { await s.broadcast(args, hooks); s.setRecord(payment(args.quote, "pending")); return { kind: "final", transaction, receipt_ids: ["receipt"], admission: { kind: "payment", payment: payment(args.quote, "pending"), duplicate: false } }; });
    expect((await s.client.payService(s.args)).kind).toBe("uncertain"); expect(s.urls).toHaveLength(1);
    s.setRecord(payment(s.submitted!.quote, "failed")); expect((await s.client.payService(s.args)).kind).toBe("failed"); expect(s.broadcasts).toBe(1); expect(s.urls).toHaveLength(1);
  });
  it("surfaces a bound final rejection of its single submitted transaction", async () => {
    const s = await setup(); const rejected: SubmissionResult = { kind: "final", transaction, receipt_ids: ["deny-receipt"], admission: { kind: "rejected", decision: { kind: "deny", code: "DAILY_CAP" } } };
    s.execute.mockImplementationOnce(async (args, hooks) => { await s.broadcast(args, hooks); return rejected; }); s.resolve.mockResolvedValue(rejected);
    expect(await s.client.payService(s.args)).toEqual({ kind: "denied", origin: "executed_rejection", payment_id: context.payment_id, decision: { kind: "deny", code: "DAILY_CAP" }, transaction, receipt_ids: ["deny-receipt"] });
    expect(s.broadcasts).toBe(1);
  });
});
