import { createHash, createPublicKey, verify } from "node:crypto";
import type {
  Hash32, IdentityDescriptorV1, InvoiceV1, PublicKey32, Signature64, SignedInvoiceV1,
} from "./types.js";

const INVOICE_DOMAIN = "AGENTTRUST_NEAR_INVOICE_V1\0";
const IDENTITY_DOMAIN = "AGENTTRUST_NEAR_IDENTITY_V1\0";
const REQUEST_DOMAIN = "AGENTTRUST_INVOICE_AUDIT_REQUEST_V1\0";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const MAX_U64 = (1n << 64n) - 1n;
const INVOICE_FIELDS = [
  "schema_version", "network", "core_account", "owner_id", "session_id", "payment_id",
  "policy_revision", "profile_id", "profile_revision", "service_id", "service_version",
  "payout_account", "endpoint_hash", "request_hash", "asset", "amount_yocto", "issued_at_ns", "expires_at_ns",
] as const;
const IDENTITY_FIELDS = [
  "schema_version", "network", "core_account", "challenge_nonce", "service_id", "service_version",
  "payout_account", "endpoint_hash", "invoice_key", "issued_at_ns", "expires_at_ns",
] as const;

function invalid(field: string, requirement: string): never {
  throw new TypeError(`${field}: ${requirement}`);
}

function record(value: unknown, fields: readonly string[], name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalid(name, "expected an object");
  }
  if (Object.keys(value).length !== fields.length || fields.some((field) => !Object.hasOwn(value, field))) {
    return invalid(name, "missing or unrecognized fields");
  }
  return value as Record<string, unknown>;
}

function utf8(value: unknown, field: string): Buffer {
  if (typeof value !== "string") return invalid(field, "expected a string");
  const bytes = Buffer.from(value, "utf8");
  if (bytes.toString("utf8") !== value) return invalid(field, "unpaired UTF-16 surrogate");
  return bytes;
}

function stringBytes(value: unknown, field: string, kind?: "account" | "profile"): Buffer {
  const bytes = utf8(value, field);
  if (kind === "account" && (bytes.length < 2 || bytes.length > 64 ||
      !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(value as string))) {
    return invalid(field, "invalid NEAR account ID");
  }
  if (kind === "profile" && (bytes.length < 1 || bytes.length > 64)) {
    return invalid(field, "expected 1 to 64 UTF-8 bytes");
  }
  if (bytes.length > 0xffffffff) return invalid(field, "string exceeds Borsh length");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function fixedBytes(value: unknown, length: number, field: string): Buffer {
  if (typeof value !== "string" || value.length !== 4 * Math.ceil(length / 3)) {
    return invalid(field, `expected canonical padded base64 of ${length} bytes`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== length || bytes.toString("base64") !== value) {
    return invalid(field, `expected canonical padded base64 of ${length} bytes`);
  }
  return bytes;
}

function smallInteger(value: unknown, width: 1 | 4, field: string): Buffer {
  const maximum = width === 1 ? 0xff : 0xffffffff;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maximum) {
    return invalid(field, `expected an integral number from 0 to ${maximum}`);
  }
  const bytes = Buffer.alloc(width);
  if (width === 1) bytes.writeUInt8(value);
  else bytes.writeUInt32LE(value);
  return bytes;
}

function decimalInteger(value: unknown, width: 8 | 16, field: string): Buffer {
  if (typeof value !== "string" || value.length > (width === 8 ? 20 : 39) ||
      !/^(0|[1-9][0-9]*)$/.test(value)) {
    return invalid(field, "expected a canonical unsigned decimal string");
  }
  const integer = BigInt(value);
  if (integer >= 1n << BigInt(width * 8)) return invalid(field, `exceeds U${width * 8}`);
  const bytes = Buffer.alloc(width);
  bytes.writeBigUInt64LE(integer & MAX_U64);
  if (width === 16) bytes.writeBigUInt64LE(integer >> 64n, 8);
  return bytes;
}

/** Encode wire shape only. Current domain/schema/asset/time authorization is checked at admission. */
export function encodeInvoice(invoice: InvoiceV1): Uint8Array {
  const value = record(invoice, INVOICE_FIELDS, "invoice");
  return Buffer.concat([
    Buffer.from(INVOICE_DOMAIN, "ascii"),
    smallInteger(value.schema_version, 1, "schema_version"),
    stringBytes(value.network, "network"),
    stringBytes(value.core_account, "core_account", "account"),
    stringBytes(value.owner_id, "owner_id", "account"),
    fixedBytes(value.session_id, 32, "session_id"),
    fixedBytes(value.payment_id, 32, "payment_id"),
    smallInteger(value.policy_revision, 4, "policy_revision"),
    stringBytes(value.profile_id, "profile_id", "profile"),
    smallInteger(value.profile_revision, 4, "profile_revision"),
    stringBytes(value.service_id, "service_id", "account"),
    smallInteger(value.service_version, 4, "service_version"),
    stringBytes(value.payout_account, "payout_account", "account"),
    fixedBytes(value.endpoint_hash, 32, "endpoint_hash"),
    fixedBytes(value.request_hash, 32, "request_hash"),
    stringBytes(value.asset, "asset"),
    decimalInteger(value.amount_yocto, 16, "amount_yocto"),
    decimalInteger(value.issued_at_ns, 8, "issued_at_ns"),
    decimalInteger(value.expires_at_ns, 8, "expires_at_ns"),
  ]);
}

export function invoiceHash(invoice: InvoiceV1): Hash32 {
  return createHash("sha256").update(encodeInvoice(invoice)).digest("base64");
}

/** Encode a descriptor without treating its embedded key as a trust root. */
export function encodeIdentityDescriptor(descriptor: IdentityDescriptorV1): Uint8Array {
  const value = record(descriptor, IDENTITY_FIELDS, "identity descriptor");
  return Buffer.concat([
    Buffer.from(IDENTITY_DOMAIN, "ascii"),
    smallInteger(value.schema_version, 1, "schema_version"),
    stringBytes(value.network, "network"),
    stringBytes(value.core_account, "core_account", "account"),
    fixedBytes(value.challenge_nonce, 32, "challenge_nonce"),
    stringBytes(value.service_id, "service_id", "account"),
    smallInteger(value.service_version, 4, "service_version"),
    stringBytes(value.payout_account, "payout_account", "account"),
    fixedBytes(value.endpoint_hash, 32, "endpoint_hash"),
    fixedBytes(value.invoice_key, 32, "invoice_key"),
    decimalInteger(value.issued_at_ns, 8, "issued_at_ns"),
    decimalInteger(value.expires_at_ns, 8, "expires_at_ns"),
  ]);
}

export function identityDescriptorHash(descriptor: IdentityDescriptorV1): Hash32 {
  return createHash("sha256").update(encodeIdentityDescriptor(descriptor)).digest("base64");
}

/** Hash exact accepted CSV UTF-8 bytes: no trimming, BOM removal or normalization. */
export function requestHash(csvUtf8: string): Hash32 {
  const bytes = utf8(csvUtf8, "CSV");
  if (bytes.length > 64 * 1024) return invalid("CSV", "exceeds 64KiB");
  return createHash("sha256").update(REQUEST_DOMAIN, "ascii").update(bytes).digest("base64");
}

function verifyEd25519(message: Uint8Array, signature: unknown, registeredPublicKey: unknown): boolean {
  const keyBytes = fixedBytes(registeredPublicKey, 32, "registered public key");
  const signatureBytes = fixedBytes(signature, 64, "signature");
  const key = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, keyBytes]), format: "der", type: "spki",
  });
  return verify(null, message, key, signatureBytes);
}

/** Cryptographic validity only; the caller supplies the independently registered service key. */
export function verifyInvoiceSignature(quote: SignedInvoiceV1, registeredPublicKey: PublicKey32): boolean {
  try {
    const value = record(quote, ["invoice", "signature"], "signed invoice");
    return verifyEd25519(encodeInvoice(value.invoice as InvoiceV1), value.signature, registeredPublicKey);
  } catch {
    return false;
  }
}

/** Does not prove nonce, identity/version, dates, credential status or endpoint ownership. */
export function verifyIdentityDescriptorSignature(
  descriptor: IdentityDescriptorV1, signature: Signature64, registeredPublicKey: PublicKey32,
): boolean {
  try {
    return verifyEd25519(encodeIdentityDescriptor(descriptor), signature, registeredPublicKey);
  } catch {
    return false;
  }
}

/** Shared strict wire validation for native read/call adapters. */
export function validateAccountId(value: string): void { stringBytes(value, "account_id", "account"); }
export function validateProfileId(value: string): void { stringBytes(value, "profile_id", "profile"); }
export function validateHash32(value: string): void { fixedBytes(value, 32, "hash"); }
export function validateU64(value: string): void { decimalInteger(value, 8, "u64"); }
export function validateU128(value: string): void { decimalInteger(value, 16, "u128"); }
export function validateSignedInvoice(quote: import("./types.js").SignedInvoiceV1): void {
  record(quote, ["invoice", "signature"], "signed invoice");
  encodeInvoice(quote.invoice); fixedBytes(quote.signature, 64, "signature");
}
