import { describe, expect, it } from "vitest";
import { once } from "node:events";
import { createAuditHandler, createAuditHttpServer, type AuditServerConfig } from "../src/server.js";
import { auditCsv } from "../src/audit.js";
import { MAX_HTTP_BODY, PAID_PROTOCOL } from "../../../packages/near-sdk/src/paid-protocol.js";
import { invoiceHash, verifyInvoiceSignature } from "../../../packages/near-sdk/src/codec.js";
import { block, context, csv, hash, invoiceKey, now, origin, payment, quote, service, signBytes, transaction } from "./paid-fixtures.js";

function setup(): { config: AuditServerConfig; calls: string[] } {
  const calls: string[] = [];
  return { calls, config: { network: "near:testnet", core_account: "core.testnet", offer: { service, origin, amount_yocto: "10" }, sign: signBytes, nowNs: () => now,
    reader: { network: "near:testnet", coreAccount: "core.testnet", getPaymentSnapshot: async () => { calls.push("view"); return { value: payment(), block }; }, resolveSubmission: async () => { calls.push("final"); return { kind: "final", transaction, receipt_ids: ["receipt"], admission: { kind: "payment", payment: payment(quote(), "pending"), duplicate: false } }; } },
  } };
}
const request = (body: unknown, path = "/v1/invoice-audit") => new Request(origin + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const redeem = () => ({ mode: "redeem", csv_utf8: csv, quote: quote(), credential: null, transaction });

describe("custom native HTTP402 provider", () => {
  it("returns a signed exact quote, not a report, without treating public context as authorization", async () => {
    const { config, calls } = setup(); const response = await createAuditHandler(config)(request({ mode: "quote", csv_utf8: csv, context }));
    expect(response.status).toBe(402); const body = await response.json();
    expect(body.protocol).toBe(PAID_PROTOCOL); expect(body.quote).toEqual(quote());
    expect(verifyInvoiceSignature(body.quote, invoiceKey)).toBe(true); expect(body.report).toBeUndefined(); expect(calls).toEqual([]);
  });
  it("recomputes real output only after its own FINAL call and settled final-state queries", async () => {
    const { config, calls } = setup(); const response = await createAuditHandler(config)(request(redeem()));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ protocol: PAID_PROTOCOL, invoice_hash: invoiceHash(quote().invoice), report: auditCsv(csv) });
    expect(calls.sort()).toEqual(["final", "view"]);
  });
  it.each(["pending", "failed", "missing"] as const)("does not release for %s final contract state", async (state) => {
    const { config } = setup(); config.reader.getPaymentSnapshot = async () => ({ value: state === "missing" ? null : payment(quote(), state), block });
    expect((await createAuditHandler(config)(request(redeem()))).status).toBe(409);
  });
  it("does not release for HTTP/RPC success or inclusion without FINAL execution", async () => {
    const { config } = setup(); config.reader.resolveSubmission = async () => ({ kind: "uncertain", transaction, reason: "not_final" });
    expect((await createAuditHandler(config)(request(redeem()))).status).toBe(409);
    config.reader.getPaymentSnapshot = async () => ({ value: payment(), block: { ...block, finality: "optimistic" as "final" } });
    expect((await createAuditHandler(config)(request(redeem()))).status).toBe(409);
  });
  it.each([
    { payout_account: "other.testnet" }, { amount_yocto: "11" }, { core_account: "other.testnet" }, { request_hash: hash(9) }, { owner_id: "other.testnet" }, { service_version: 2 }, { endpoint_hash: hash(8) },
  ])("rejects changed bound receipt fields %j", async (change) => {
    const { config } = setup(); config.reader.getPaymentSnapshot = async () => ({ value: payment(quote(change)), block });
    expect((await createAuditHandler(config)(request(redeem()))).status).toBe(409);
  });
  it("rejects forged quotes, changed CSV and tampered prices before any result", async () => {
    for (const body of [{ ...redeem(), quote: { ...quote(), signature: Buffer.alloc(64).toString("base64") } }, { ...redeem(), csv_utf8: csv + "v2,i2,2.00,USD\n" }, { ...redeem(), quote: { ...quote(), invoice: { ...quote().invoice, amount_yocto: "9" } } }]) {
      expect((await createAuditHandler(setup().config)(request(body))).status).toBe(400);
    }
  });
  it("honors a signed settled original price when the advertised price later changes", async () => {
    const { config } = setup(); config.offer = { ...config.offer, amount_yocto: "999" };
    expect((await createAuditHandler(config)(request(redeem()))).status).toBe(200);
  });
  it("redeems original bytes after quote expiry and service/key/price rotation using retained offers", async () => {
    const { config } = setup(); const oldOffer = config.offer;
    config.offer = { ...oldOffer, service: { ...service, version: 2, invoice_key: hash(7), payout_account: "newpayee.testnet" }, amount_yocto: "999" };
    config.retainedOffers = [oldOffer]; config.nowNs = () => now + 600_000_000_000n;
    const response = await createAuditHandler(config)(request(redeem())); expect(response.status).toBe(200);
    expect((await response.json()).report).toEqual(auditCsv(csv));
  });
  it("serves the existing identity and fixed conformance routes, rejecting arbitrary CSV", async () => {
    const handler = createAuditHandler(setup().config);
    expect((await handler(request({ challenge_nonce: hash(6) }, "/v1/identity-challenge"))).status).toBe(200);
    expect((await handler(request({ fixture_id: "mixed-validity" }, "/v1/conformance"))).status).toBe(200);
    expect((await handler(request({ fixture_id: "mixed-validity", csv_utf8: "private" }, "/v1/conformance"))).status).toBe(400);
  });
  it("rejects malformed/oversized bodies and unsupported routes/methods without redirects", async () => {
    const handler = createAuditHandler(setup().config);
    expect((await handler(request({ mode: "quote", csv_utf8: csv, context, payout: "evil" }))).status).toBe(400);
    expect((await handler(request({ mode: "quote", csv_utf8: "x".repeat(MAX_HTTP_BODY), context }))).status).toBe(413);
    expect((await handler(request({}, "/missing"))).status).toBe(404);
    expect((await handler(new Request(origin + "/v1/invoice-audit"))).status).toBe(405);
    expect((await handler(new Request(origin + "/v1/invoice-audit", { method: "POST", body: "{}" }))).status).toBe(415);
  });
  it("rejects a reader configured for a different chain/core", () => {
    const { config } = setup(); config.reader = { ...config.reader, coreAccount: "evil.testnet" };
    expect(() => createAuditHandler(config)).toThrow("DOMAIN_MISMATCH");
  });
  it("runs the actual local HTTP adapter with quote and fixed-fixture requests", async () => {
    const server = createAuditHttpServer(setup().config); server.listen(0, "127.0.0.1"); await once(server, "listening");
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("missing port");
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(base + "/v1/invoice-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "quote", csv_utf8: csv, context }) });
      expect(response.status).toBe(402); expect((await response.json()).quote).toEqual(quote());
      const fixture = await fetch(base + "/v1/conformance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fixture_id: "header-only" }) });
      expect(fixture.status).toBe(200); expect((await fixture.json()).report.row_count).toBe(0);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
});
