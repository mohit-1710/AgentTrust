import { createHash, randomBytes } from "node:crypto";
import { encodeIdentityDescriptor, identityDescriptorHash } from "../../../packages/near-sdk/src/codec.js";
import { checkAuditOutput } from "./check-output.js";
import { loadConformanceSuite } from "./conformance.js";
import { endpointHash, verifyIdentityChallenge, type RegisteredService, type SignedIdentityDescriptor } from "./identity.js";

export interface CatalogEntry { service_id: string; service_version: number; origin: string }
export interface CredentialAssertion {
  service_id: string;
  service_version: number;
  capability_namespace: "invoice.audit";
  capability_version: 1;
  conformance_suite_version: 1;
  conformance_suite_hash: string;
  evidence_manifest_hash: string;
  issued_at_ns: string;
  expires_at_ns: string;
}
export interface ValidationOptions {
  network: "near:testnet";
  core_account: string;
  issuer_id: string;
  catalog: readonly CatalogEntry[];
  credential_expires_at_ns: string;
  /** Adapter must read the pinned network/core registry, never a provider's self-description. */
  readService: (serviceId: string) => Promise<RegisteredService | null>;
  fetch?: typeof fetch;
  nowNs?: () => bigint;
}
export interface ValidationEvidence {
  schema_version: 1;
  claim: "controlled_fixture_conformance_only";
  network: "near:testnet";
  core_account: string;
  issuer_id: string;
  origin: string;
  service_id: string;
  service_version: number;
  started_at_ns: string;
  completed_at_ns: string;
  descriptor: SignedIdentityDescriptor;
  descriptor_hash: string;
  conformance_suite_version: 1;
  conformance_suite_hash: string;
  results: { fixture_id: string; csv_sha256: string; golden_sha256: string; response_sha256: string; response_json: string; passed: true }[];
}
export type ValidationResult = {
  ok: true; assertion: CredentialAssertion; evidence: ValidationEvidence; evidence_json: string;
} | { ok: false; code: string; fixture_id?: string };

class ValidationError extends Error {
  constructor(readonly code: string, readonly fixture_id?: string) { super(code); }
}
function fail(code: string, fixture?: string): never { throw new ValidationError(code, fixture); }
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("base64");

/** Hash the exact compact evidence_json bytes returned by validateService; no reformatting. */
export function evidenceManifestHash(exactJson: string): string {
  return createHash("sha256").update("AGENTTRUST_INVOICE_AUDIT_EVIDENCE_V1\0", "ascii").update(exactJson, "utf8").digest("base64");
}

function validateRegistryService(service: RegisteredService | null, serviceId: string, options: ValidationOptions): RegisteredService {
  if (!service || service.active !== true || service.service_id !== serviceId || service.version < 1) fail("INVALID_SERVICE");
  // Reuse native account/key/hash/integer wire validation without treating these bytes as signed evidence.
  encodeIdentityDescriptor({
    schema_version: 1, network: options.network, core_account: options.core_account,
    challenge_nonce: Buffer.alloc(32).toString("base64"), service_id: service.service_id,
    service_version: service.version, payout_account: service.payout_account,
    endpoint_hash: service.endpoint_hash, invoice_key: service.invoice_key, issued_at_ns: "0", expires_at_ns: "1",
  });
  return { ...service };
}

async function postJson(fetcher: typeof fetch, url: string, body: unknown): Promise<{ body: unknown; hash: string; json: string }> {
  try {
    const response = await fetcher(url, {
      method: "POST", redirect: "error", headers: { "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5_000),
    });
    if (response.redirected || response.status >= 300 && response.status < 400 || response.url && response.url !== url) fail("HTTP_REDIRECT");
    if (response.status !== 200 || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json" || !response.body) {
      fail("HTTP_RESPONSE_INVALID");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 64 * 1024) { await reader.cancel(); fail("HTTP_RESPONSE_TOO_LARGE"); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    const json = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    return { body: JSON.parse(json) as unknown, hash: sha256(bytes), json };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    return fail("HTTP_REQUEST_FAILED");
  }
}

/**
 * Prepares an assertion only after bounded public fixtures and the identity challenge pass.
 * It does not sign a NEAR transaction or issue a credential. A separate direct issuer account
 * submits the assertion; the contract rechecks exact service version at that time.
 */
export async function validateService(serviceId: string, options: ValidationOptions): Promise<ValidationResult> {
  try {
    if (options.network !== "near:testnet" || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(options.issuer_id) ||
        options.issuer_id.length < 2 || options.issuer_id.length > 64 ||
        !/^(0|[1-9][0-9]*)$/.test(options.credential_expires_at_ns) || options.credential_expires_at_ns.length > 20) fail("INVALID_CONFIGURATION");
    const credentialExpiry = BigInt(options.credential_expires_at_ns);
    if (credentialExpiry > (1n << 64n) - 1n) fail("INVALID_CONFIGURATION");
    const nowNs = options.nowNs ?? (() => BigInt(Date.now()) * 1_000_000n);
    const started = nowNs();
    if (started < 0n || credentialExpiry <= started) fail("INVALID_CREDENTIAL_DATES");
    const suite = loadConformanceSuite();
    const service = validateRegistryService(await options.readService(serviceId), serviceId, options);
    const entries = options.catalog.filter((entry) => entry.service_id === serviceId && entry.service_version === service.version);
    if (entries.length !== 1) fail("ENDPOINT_UNCONFIGURED");
    const origin = entries[0]!.origin;
    if (endpointHash(origin) !== service.endpoint_hash) fail("ENDPOINT_MISMATCH");
    const nonce = randomBytes(32).toString("base64");
    const context = { network: options.network, core_account: options.core_account, service };
    const fetcher = options.fetch ?? globalThis.fetch;
    const challengeResponse = await postJson(fetcher, `${origin}/v1/identity-challenge`, { challenge_nonce: nonce });
    const descriptor = verifyIdentityChallenge(challengeResponse.body, context, nonce, nowNs());
    const results: ValidationEvidence["results"] = [];
    for (const fixture of suite.fixtures) {
      const response = await postJson(fetcher, `${origin}/v1/conformance`, { fixture_id: fixture.fixture_id });
      const body = response.body;
      if (body === null || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 3 ||
          !("fixture_id" in body) || body.fixture_id !== fixture.fixture_id ||
          !("conformance_suite_hash" in body) || body.conformance_suite_hash !== suite.hash ||
          !("report" in body) || !checkAuditOutput(fixture.csv_utf8, body.report, fixture.golden).ok) {
        fail("CONFORMANCE_FAILED", fixture.fixture_id);
      }
      results.push({ fixture_id: fixture.fixture_id, csv_sha256: fixture.csv_sha256, golden_sha256: fixture.golden_sha256, response_sha256: response.hash, response_json: response.json, passed: true });
    }
    const current = await options.readService(serviceId);
    if (!current || current.active !== true || current.service_id !== service.service_id || current.version !== service.version ||
        current.payout_account !== service.payout_account || current.invoice_key !== service.invoice_key || current.endpoint_hash !== service.endpoint_hash) {
      fail("IDENTITY_CHANGED");
    }
    const completed = nowNs();
    verifyIdentityChallenge(descriptor, context, nonce, completed);
    if (completed < started || credentialExpiry <= completed) fail("INVALID_CREDENTIAL_DATES");
    const evidence: ValidationEvidence = {
      schema_version: 1, claim: "controlled_fixture_conformance_only", network: options.network, core_account: options.core_account,
      issuer_id: options.issuer_id, origin, service_id: service.service_id, service_version: service.version,
      started_at_ns: started.toString(), completed_at_ns: completed.toString(),
      descriptor, descriptor_hash: identityDescriptorHash(descriptor.descriptor),
      conformance_suite_version: suite.version, conformance_suite_hash: suite.hash, results,
    };
    const evidence_json = JSON.stringify(evidence);
    return {
      ok: true, evidence, evidence_json,
      assertion: {
        service_id: service.service_id, service_version: service.version,
        capability_namespace: "invoice.audit", capability_version: 1,
        conformance_suite_version: suite.version, conformance_suite_hash: suite.hash,
        evidence_manifest_hash: evidenceManifestHash(evidence_json),
        issued_at_ns: completed.toString(), expires_at_ns: options.credential_expires_at_ns,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.fixture_id === undefined ? { ok: false, code: error.code } : { ok: false, code: error.code, fixture_id: error.fixture_id };
    }
    return { ok: false, code: "VALIDATION_FAILED" };
  }
}
