import { encodeIdentityDescriptor, verifyIdentityDescriptorSignature } from "../../../packages/near-sdk/src/codec.js";
import type { IdentityDescriptorV1 } from "../../../packages/near-sdk/src/types.js";

export interface RegisteredService {
  service_id: string;
  version: number;
  payout_account: string;
  invoice_key: string;
  endpoint_hash: string;
  active: boolean;
}
export interface IdentityContext { network: "near:testnet"; core_account: string; service: RegisteredService }
export interface SignedIdentityDescriptor { descriptor: IdentityDescriptorV1; signature: string }
export interface IdentityHandlerConfig extends IdentityContext {
  origin: string;
  nowNs: () => bigint;
  sign: (bytes: Uint8Array) => string;
}

export { canonicalOrigin, endpointHash } from "../../../packages/near-sdk/src/directory.js";
import { endpointHash } from "../../../packages/near-sdk/src/directory.js";

function exactObject(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== fields.length || fields.some((field) => !Object.hasOwn(value, field))) {
    throw new TypeError("INVALID_IDENTITY_RESPONSE");
  }
  return value as Record<string, unknown>;
}

/** Complete identity/date checks in addition to the shared codec's cryptographic verification. */
export function verifyIdentityChallenge(
  response: unknown, context: IdentityContext, nonce: string, nowNs: bigint,
): SignedIdentityDescriptor {
  const value = exactObject(response, ["descriptor", "signature"]);
  const descriptor = value.descriptor as IdentityDescriptorV1;
  encodeIdentityDescriptor(descriptor); // Reject malformed/unknown wire fields before comparisons.
  const service = context.service;
  if (context.network !== "near:testnet" || service.active !== true || service.version < 1 ||
      descriptor.schema_version !== 1 || descriptor.network !== context.network || descriptor.core_account !== context.core_account ||
      descriptor.challenge_nonce !== nonce || descriptor.service_id !== service.service_id || descriptor.service_version !== service.version ||
      descriptor.payout_account !== service.payout_account || descriptor.invoice_key !== service.invoice_key ||
      descriptor.endpoint_hash !== service.endpoint_hash) throw new Error("IDENTITY_MISMATCH");
  const issued = BigInt(descriptor.issued_at_ns);
  const expires = BigInt(descriptor.expires_at_ns);
  if (nowNs < 0n || nowNs > (1n << 64n) - 1n || issued > nowNs + 5_000_000_000n ||
      expires <= nowNs || expires <= issued || expires - issued > 300_000_000_000n) {
    throw new Error("INVALID_DESCRIPTOR_DATES");
  }
  if (typeof value.signature !== "string" || !verifyIdentityDescriptorSignature(descriptor, value.signature, service.invoice_key)) {
    throw new Error("INVALID_IDENTITY_SIGNATURE");
  }
  return { descriptor, signature: value.signature };
}

/** Host supplies its local merchant signer; no account or key may be chosen in the request. */
export function handleIdentityChallenge(body: unknown, config: IdentityHandlerConfig): SignedIdentityDescriptor {
  const request = exactObject(body, ["challenge_nonce"]);
  if (endpointHash(config.origin) !== config.service.endpoint_hash) throw new Error("ENDPOINT_MISMATCH");
  const now = config.nowNs();
  const descriptor: IdentityDescriptorV1 = {
    schema_version: 1, network: config.network, core_account: config.core_account,
    challenge_nonce: request.challenge_nonce as string,
    service_id: config.service.service_id, service_version: config.service.version,
    payout_account: config.service.payout_account, endpoint_hash: config.service.endpoint_hash,
    invoice_key: config.service.invoice_key,
    issued_at_ns: now.toString(), expires_at_ns: (now + 120_000_000_000n).toString(),
  };
  const signature = config.sign(encodeIdentityDescriptor(descriptor));
  return verifyIdentityChallenge({ descriptor, signature }, config, descriptor.challenge_nonce, now);
}
