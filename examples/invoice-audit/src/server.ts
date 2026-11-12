import { createServer, type Server } from "node:http";
import { Readable } from "node:stream";
import { encodeInvoice, invoiceHash, validateSignedInvoice, validateU128, verifyInvoiceSignature } from "../../../packages/near-sdk/src/codec.js";
import { endpointHash } from "../../../packages/near-sdk/src/directory.js";
import { observePayment, validatePayment } from "../../../packages/near-sdk/src/finality.js";
import { validateCredentialRef, validateTransactionLocator } from "../../../packages/near-sdk/src/attempts.js";
import { exactFields, MAX_HTTP_BODY, MAX_HTTP_RESPONSE, PAID_PROTOCOL, readJson, type QuoteContext, type RedemptionRequest } from "../../../packages/near-sdk/src/paid-protocol.js";
import type { AgentTrustClient } from "../../../packages/near-sdk/src/client.js";
import type { InvoiceV1, SignedInvoiceV1 } from "../../../packages/near-sdk/src/types.js";
import { handleIdentityChallenge, type RegisteredService } from "./identity.js";
import { handleConformance } from "./conformance.js";
import { auditCsv, readAuditCsv, AuditInputError } from "./audit.js";
export interface ServiceOffer { service: RegisteredService; origin: string; amount_yocto: string }
export interface AuditServerConfig {
  network: "near:testnet"; core_account: string; offer: ServiceOffer;
  retainedOffers?: readonly ServiceOffer[]; sign: (bytes: Uint8Array) => string; nowNs?: () => bigint;
  reader: Pick<AgentTrustClient, "network" | "coreAccount" | "getPaymentSnapshot" | "resolveSubmission">;
}
function json(status: number, body: unknown): Response {
  const value = JSON.stringify(body);
  if (Buffer.byteLength(value) > MAX_HTTP_RESPONSE) throw new Error("RESPONSE_TOO_LARGE");
  return new Response(value, { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
function error(status: number, code: string): Response { return json(status, { protocol: PAID_PROTOCOL, error: code }); }

/** The reader is read-only and pinned to one network/core; no owner or worker signer belongs here. */
export function createAuditHandler(config: AuditServerConfig): (request: Request) => Promise<Response> {
  if (config.network !== "near:testnet" || config.reader.network !== config.network || config.reader.coreAccount !== config.core_account) throw new Error("DOMAIN_MISMATCH");
  const network = config.network, core = config.core_account, reader = config.reader, sign = config.sign;
  const nowNs = config.nowNs ?? (() => BigInt(Date.now()) * 1_000_000n);
  const offer = structuredClone(config.offer);
  const offers = [offer, ...structuredClone(config.retainedOffers ?? [])];
  if (offers.length > 128) throw new Error("OFFER_CAPACITY");
  const versions = new Set<number>();
  for (const entry of offers) {
    validateU128(entry.amount_yocto);
    if (BigInt(entry.amount_yocto) === 0n || entry.service.service_id !== offer.service.service_id || versions.has(entry.service.version) || endpointHash(entry.origin) !== entry.service.endpoint_hash) throw new Error("INVALID_OFFER");
    versions.add(entry.service.version);
  }
  function issue(context: QuoteContext, csv: string): SignedInvoiceV1 {
    if (!exactFields(context, ["owner_id", "session_id", "payment_id", "policy_revision", "profile_id", "profile_revision"])) throw new Error("INVALID_CONTEXT");
    if (!offer.service.active) throw new Error("INACTIVE_SERVICE");
    const now = nowNs();
    const invoice: InvoiceV1 = {
      schema_version: 1, network, core_account: core, ...context,
      service_id: offer.service.service_id, service_version: offer.service.version,
      payout_account: offer.service.payout_account, endpoint_hash: offer.service.endpoint_hash,
      request_hash: readAuditCsv(csv).input_hash, asset: "NEAR", amount_yocto: offer.amount_yocto,
      issued_at_ns: now.toString(), expires_at_ns: (now + 120_000_000_000n).toString(),
    };
    const quote = { invoice, signature: sign(encodeInvoice(invoice)) };
    if (!verifyInvoiceSignature(quote, offer.service.invoice_key)) throw new Error("INVALID_SIGNER");
    return quote;
  }
  async function redeem(body: RedemptionRequest): Promise<Response> {
    validateSignedInvoice(body.quote); validateCredentialRef(body.credential);
    const invoice = body.quote.invoice;
    validateTransactionLocator(body.transaction, invoice.owner_id);
    const original = offers.find((entry) => entry.service.service_id === invoice.service_id && entry.service.version === invoice.service_version);
    // The merchant's signed original amount is the price commitment. Current
    // pricing and quote expiry must not invalidate already settled content.
    if (!original || invoice.network !== network || invoice.core_account !== core || invoice.asset !== "NEAR" ||
        invoice.payout_account !== original.service.payout_account || invoice.endpoint_hash !== original.service.endpoint_hash ||
        BigInt(invoice.amount_yocto) <= 0n || readAuditCsv(body.csv_utf8).input_hash !== invoice.request_hash ||
        !verifyInvoiceSignature(body.quote, original.service.invoice_key)) throw new Error("RECEIPT_BINDING_MISMATCH");
    try {
      const [submission, snapshot] = await Promise.all([
        reader.resolveSubmission(body.transaction, { quote: body.quote, credential: body.credential }),
        reader.getPaymentSnapshot(invoice.owner_id, invoice.payment_id),
      ]);
      const payment = validatePayment(snapshot.value, network, core, invoice.owner_id, invoice.payment_id);
      const observation = observePayment({ value: payment, block: snapshot.block }, invoice.owner_id, invoice.payment_id);
      const expected = invoiceHash(invoice);
      if (submission.kind !== "final" || submission.admission.kind !== "payment" || submission.admission.payment.invoice_hash !== expected ||
          observation.kind !== "settled" || observation.payment.invoice_hash !== expected) return error(409, "PAYMENT_NOT_VERIFIED_SETTLED");
      return json(200, { protocol: PAID_PROTOCOL, invoice_hash: expected, report: auditCsv(body.csv_utf8) });
    } catch { return error(409, "PAYMENT_NOT_VERIFIED_SETTLED"); }
  }
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.search || !["/v1/invoice-audit", "/v1/identity-challenge", "/v1/conformance"].includes(url.pathname)) return error(404, "NOT_FOUND");
    if (request.method !== "POST") return error(405, "METHOD_NOT_ALLOWED");
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return error(415, "JSON_REQUIRED");
    try {
      const body = await readJson(request.body, MAX_HTTP_BODY);
      if (url.pathname === "/v1/identity-challenge") return json(200, handleIdentityChallenge(body, { network, core_account: core, ...offer, nowNs, sign }));
      if (url.pathname === "/v1/conformance") return json(200, handleConformance(body));
      if (exactFields(body, ["mode", "csv_utf8", "context"]) && body.mode === "quote") return json(402, { protocol: PAID_PROTOCOL, quote: issue(body.context as QuoteContext, body.csv_utf8 as string) });
      if (exactFields(body, ["mode", "csv_utf8", "quote", "credential", "transaction"]) && body.mode === "redeem") return await redeem(body as unknown as RedemptionRequest);
      return error(400, "INVALID_REQUEST");
    } catch (failure) {
      if (failure instanceof Error && failure.message === "BODY_TOO_LARGE" || failure instanceof AuditInputError && failure.code === "INPUT_TOO_LARGE") return error(413, "BODY_TOO_LARGE");
      return error(400, "INVALID_REQUEST");
    }
  };
}

/** Plain HTTP listener for a local HTTPS reverse proxy. Construction does not listen or read keys. */
export function createAuditHttpServer(config: AuditServerConfig): Server {
  const handler = createAuditHandler(config);
  return createServer({ requestTimeout: 15_000, headersTimeout: 10_000, maxHeaderSize: 16 * 1024 }, async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      const method = incoming.method ?? "GET";
      const init: RequestInit & { duplex?: "half" } = { method, headers };
      if (method !== "GET" && method !== "HEAD") { init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>; init.duplex = "half"; }
      const response = await handler(new Request(new URL(incoming.url ?? "/", "http://127.0.0.1"), init));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { if (!outgoing.headersSent) outgoing.writeHead(400, { "content-type": "application/json" }); outgoing.end('{"error":"INVALID_REQUEST"}'); }
  });
}
