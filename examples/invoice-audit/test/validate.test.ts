import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { encodeIdentityDescriptor, identityDescriptorHash } from "../../../packages/near-sdk/src/codec.js";
import { FIXTURE_IDS, handleConformance, loadConformanceSuite } from "../src/conformance.js";
import { canonicalOrigin, endpointHash, handleIdentityChallenge, verifyIdentityChallenge, type RegisteredService, type SignedIdentityDescriptor } from "../src/identity.js";
import { evidenceManifestHash, validateService, type ValidationOptions } from "../src/validate.js";

const now = 1_800_000_000_000_000_000n;
const origin = "https://audit.example";
const nonce = Buffer.alloc(32, 9).toString("base64");
const keys = generateKeyPairSync("ed25519");
const otherKeys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
const rawEndpointHash = (value: string) => createHash("sha256").update(`agenttrust-http402-v1\nPOST\n${value}\n/v1/invoice-audit\n`).digest("base64");
const service: RegisteredService = { service_id: "merchant.testnet", version: 1, payout_account: "payee.testnet", invoice_key: publicKey, endpoint_hash: rawEndpointHash(origin), active: true };
const context = { network: "near:testnet" as const, core_account: "core.testnet", service };
const handler = { ...context, origin, nowNs: () => now, sign: (bytes: Uint8Array) => sign(null, bytes, keys.privateKey).toString("base64") };
function signed(change: Record<string, unknown> = {}): SignedIdentityDescriptor {
  const descriptor = { schema_version: 1 as const, network: "near:testnet" as const, core_account: "core.testnet", challenge_nonce: nonce, service_id: service.service_id, service_version: 1, payout_account: service.payout_account, endpoint_hash: service.endpoint_hash, invoice_key: publicKey, issued_at_ns: now.toString(), expires_at_ns: (now + 120_000_000_000n).toString(), ...change };
  return { descriptor, signature: sign(null, encodeIdentityDescriptor(descriptor), keys.privateKey).toString("base64") };
}
function setup(transform?: (path: string, body: unknown, response: unknown) => unknown): { options: ValidationOptions; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const options: ValidationOptions = { ...context, issuer_id: "issuer.testnet", catalog: [{ service_id: service.service_id, service_version: 1, origin }], credential_expires_at_ns: (now + 3_600_000_000_000n).toString(), readService: async () => ({ ...service }), nowNs: () => now,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init! });
      const body = JSON.parse(String(init!.body)) as unknown;
      const path = new URL(String(url)).pathname;
      const response = path === "/v1/identity-challenge" ? handleIdentityChallenge(body, handler) : handleConformance(body);
      return Response.json(transform ? transform(path, body, response) : response);
    },
  };
  return { options, calls };
}

describe("endpoint identity challenge", () => {
  it("commits exact canonical HTTPS origin and the paid route", () => {
    expect(canonicalOrigin(origin)).toBe(origin);
    expect(endpointHash(origin)).toBe(rawEndpointHash(origin));
    expect(endpointHash("https://audit.example:8443")).not.toBe(endpointHash(origin));
  });
  it.each(["http://audit.example", "https://AUDIT.example", "https://audit.example/", "https://audit.example:443", "https://x@audit.example", "https://audit.example?q=1", "https://audit.example#f", "https://audit.example/path", "https://é.example", " https://audit.example", "https://audit.example\\evil"])("rejects noncanonical or non-HTTPS origin %s", (input) => expect(() => canonicalOrigin(input)).toThrow());
  it("signs the caller nonce with operator-pinned identity and verifies the registered key", () => {
    const response = handleIdentityChallenge({ challenge_nonce: nonce }, handler);
    expect(verifyIdentityChallenge(response, context, nonce, now)).toEqual(response);
    expect(response.descriptor.expires_at_ns).toBe((now + 120_000_000_000n).toString());
  });
  it.each([{ challenge_nonce: nonce, payout_account: "attacker.testnet" }, { challenge_nonce: "bad" }, {}, { challenge_nonce: nonce, csv_utf8: "secret" }])("rejects malformed or authority-supplying challenge body %j", (body) => expect(() => handleIdentityChallenge(body, handler)).toThrow());
  it("rejects signing configuration that does not own the registered key", () => {
    expect(() => handleIdentityChallenge({ challenge_nonce: nonce }, { ...handler, sign: (bytes) => sign(null, bytes, otherKeys.privateKey).toString("base64") })).toThrow();
    expect(() => handleIdentityChallenge({ challenge_nonce: nonce }, { ...handler, origin: "https://different.example" })).toThrow();
  });
  it.each([
    ["challenge_nonce", Buffer.alloc(32, 1).toString("base64")], ["service_id", "other.testnet"], ["service_version", 2], ["payout_account", "other.testnet"], ["endpoint_hash", Buffer.alloc(32).toString("base64")], ["invoice_key", otherKeys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64")], ["network", "near:mainnet"], ["core_account", "different.testnet"], ["schema_version", 2],
  ])("rejects signed but mismatching %s", (field, value) => expect(() => verifyIdentityChallenge(signed({ [field]: value }), context, nonce, now)).toThrow());
  it.each([
    { issued_at_ns: (now + 5_000_000_001n).toString() },
    { expires_at_ns: now.toString() },
    { expires_at_ns: (now + 300_000_000_001n).toString() },
    { issued_at_ns: (now + 1n).toString(), expires_at_ns: (now + 1n).toString() },
  ])("rejects invalid descriptor dates %j", (change) => expect(() => verifyIdentityChallenge(signed(change), context, nonce, now)).toThrow());
  it("accepts exact five-second skew and maximum lifetime boundaries", () => {
    expect(verifyIdentityChallenge(signed({ issued_at_ns: (now + 5_000_000_000n).toString(), expires_at_ns: (now + 305_000_000_000n).toString() }), context, nonce, now)).toBeDefined();
  });
  it("rejects bad signatures, unknown fields and inactive registry snapshots", () => {
    expect(() => verifyIdentityChallenge({ ...signed(), signature: Buffer.alloc(64).toString("base64") }, context, nonce, now)).toThrow();
    expect(() => verifyIdentityChallenge({ ...signed(), ignored: true }, context, nonce, now)).toThrow();
    expect(() => verifyIdentityChallenge(signed(), { ...context, service: { ...service, active: false } }, nonce, now)).toThrow();
  });
});

describe("committed public conformance fixtures", () => {
  it("hashes exact manifest, CSV and manual golden bytes", () => {
    const suite = loadConformanceSuite();
    const raw = readFileSync(new URL("../../../fixtures/invoice-audit/v1/suite.json", import.meta.url));
    expect(suite.hash).toBe(createHash("sha256").update("AGENTTRUST_INVOICE_AUDIT_SUITE_V1\0").update(raw).digest("base64"));
    expect(suite.fixtures.map((fixture) => fixture.fixture_id)).toEqual(FIXTURE_IDS);
    for (const fixture of suite.fixtures) {
      expect(createHash("sha256").update(fixture.csv_utf8).digest("base64")).toBe(fixture.csv_sha256);
      expect(handleConformance({ fixture_id: fixture.fixture_id })).toEqual({ fixture_id: fixture.fixture_id, conformance_suite_hash: suite.hash, report: fixture.golden });
    }
  });
  it.each([{}, { fixture_id: "../secret" }, { fixture_id: "mixed-validity", csv_utf8: "private" }, { fixture_id: "mixed-validity", payment_id: nonce }, { csv_utf8: "vendor_id,invoice_id,amount,currency" }, { fixture_id: "mixed-validity", extra: null }])("cannot audit arbitrary input through conformance route %j", (body) => expect(() => handleConformance(body)).toThrow());
});

describe("bounded validator and assertion preparation", () => {
  it("checks the endpoint suite and rechecks identity before preparing only the scoped assertion", async () => {
    const { options, calls } = setup();
    let registryReads = 0;
    options.readService = async () => { registryReads++; return { ...service }; };
    const result = await validateService(service.service_id, options);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    expect(registryReads).toBe(2);
    expect(calls).toHaveLength(5);
    expect(calls.every((call) => call.url.startsWith(origin + "/v1/") && call.init.redirect === "error" && call.init.method === "POST")).toBe(true);
    expect(calls.slice(1).map((call) => JSON.parse(String(call.init.body)))).toEqual(FIXTURE_IDS.map((fixture_id) => ({ fixture_id })));
    expect(result.evidence.claim).toBe("controlled_fixture_conformance_only");
    expect(result.evidence.descriptor_hash).toBe(identityDescriptorHash(result.evidence.descriptor.descriptor));
    expect(result.assertion).toEqual({ service_id: service.service_id, service_version: 1, capability_namespace: "invoice.audit", capability_version: 1, conformance_suite_version: 1, conformance_suite_hash: loadConformanceSuite().hash, evidence_manifest_hash: evidenceManifestHash(result.evidence_json), issued_at_ns: now.toString(), expires_at_ns: options.credential_expires_at_ns });
    expect(result.assertion.evidence_manifest_hash).not.toBe(result.assertion.conformance_suite_hash);
    expect(JSON.parse(result.evidence_json)).toEqual(result.evidence);
    expect(result.assertion.evidence_manifest_hash).toBe(createHash("sha256").update("AGENTTRUST_INVOICE_AUDIT_EVIDENCE_V1\0", "ascii").update(result.evidence_json, "utf8").digest("base64"));
    for (const item of result.evidence.results) {
      expect(item.response_sha256).toBe(createHash("sha256").update(item.response_json, "utf8").digest("base64"));
      expect(JSON.parse(item.response_json).fixture_id).toBe(item.fixture_id);
    }
  });
  it("uses a fresh nonce and distinct run evidence for every validation", async () => {
    const first = await validateService(service.service_id, setup().options);
    const second = await validateService(service.service_id, setup().options);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.evidence.descriptor.descriptor.challenge_nonce).not.toBe(second.evidence.descriptor.descriptor.challenge_nonce);
      expect(first.assertion.conformance_suite_hash).toBe(second.assertion.conformance_suite_hash);
      expect(first.assertion.evidence_manifest_hash).not.toBe(second.assertion.evidence_manifest_hash);
    }
  });
  it.each(["nonce", "signature", "wrong_suite", "wrong_fixture", "wrong_report"])("never produces an assertion for failing %s", async (failure) => {
    const { options } = setup((path, _body, response) => {
      const copy = structuredClone(response) as any;
      if (path.endsWith("identity-challenge")) {
        if (failure === "nonce") copy.descriptor.challenge_nonce = nonce;
        if (failure === "signature") copy.signature = Buffer.alloc(64).toString("base64");
      } else {
        if (failure === "wrong_suite") copy.conformance_suite_hash = nonce;
        if (failure === "wrong_fixture") copy.fixture_id = "wrong";
        if (failure === "wrong_report") copy.report.row_count++;
      }
      return copy;
    });
    const result = await validateService(service.service_id, options);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("assertion");
  });
  it.each(["not_configured", "wrong_hash", "duplicate_catalog", "bad_origin", "inactive", "wrong_service", "missing"])("never sends to unconfigured or mismatched identity: %s", async (failure) => {
    const { options, calls } = setup();
    if (failure === "not_configured") options.catalog = [];
    if (failure === "wrong_hash") options.readService = async () => ({ ...service, endpoint_hash: nonce });
    if (failure === "duplicate_catalog") options.catalog = [...options.catalog, ...options.catalog];
    if (failure === "bad_origin") options.catalog = [{ service_id: service.service_id, service_version: 1, origin: "http://169.254.169.254" }];
    if (failure === "inactive") options.readService = async () => ({ ...service, active: false });
    if (failure === "wrong_service") options.readService = async () => ({ ...service, service_id: "different.testnet" });
    if (failure === "missing") options.readService = async () => null;
    expect((await validateService(service.service_id, options)).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it.each(["version", "key", "payout", "endpoint", "inactive", "removed"])("fails if registry %s changes during validation", async (change) => {
    const { options } = setup(); let reads = 0;
    options.readService = async () => {
      if (++reads === 1) return { ...service };
      if (change === "removed") return null;
      return { ...service, ...(change === "version" ? { version: 2 } : change === "key" ? { invoice_key: nonce } : change === "payout" ? { payout_account: "changed.testnet" } : change === "endpoint" ? { endpoint_hash: nonce } : { active: false }) };
    };
    expect(await validateService(service.service_id, options)).toEqual({ ok: false, code: "IDENTITY_CHANGED" });
  });
  it.each(["redirect", "followed_redirect", "url_changed", "http_error", "oversized", "bad_json", "wrong_type", "network_error"])("rejects untrusted HTTP transport result %s", async (failure) => {
    const { options } = setup();
    options.fetch = async () => {
      if (failure === "network_error") throw new Error("network");
      if (failure === "redirect") return new Response(null, { status: 307, headers: { location: "https://other.example" } });
      if (failure === "http_error") return new Response(null, { status: 500 });
      if (failure === "oversized") return new Response("x".repeat(65537), { headers: { "content-type": "application/json" } });
      if (failure === "bad_json") return new Response("{", { headers: { "content-type": "application/json" } });
      if (failure === "wrong_type") return new Response("{}", { headers: { "content-type": "text/html" } });
      const response = Response.json(signed());
      if (failure === "followed_redirect") Object.defineProperty(response, "redirected", { value: true });
      if (failure === "url_changed") Object.defineProperty(response, "url", { value: "https://other.example/v1/identity-challenge" });
      return response;
    };
    const result = await validateService(service.service_id, options);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("assertion");
  });
  it("rechecks descriptor expiry after the suite and rejects expired credential dates", async () => {
    const first = setup(); let clocks = 0;
    first.options.nowNs = () => ++clocks > 2 ? now + 120_000_000_000n : now;
    expect((await validateService(service.service_id, first.options)).ok).toBe(false);
    const second = setup(); second.options.credential_expires_at_ns = now.toString();
    expect((await validateService(service.service_id, second.options)).ok).toBe(false);
  });
});
