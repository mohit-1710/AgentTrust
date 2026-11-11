import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  encodeIdentityDescriptor, encodeInvoice, identityDescriptorHash, invoiceHash,
  requestHash, verifyIdentityDescriptorSignature, verifyInvoiceSignature,
} from "../src/codec.js";
import type { IdentityDescriptorV1, InvoiceV1, SignedInvoiceV1 } from "../src/types.js";

interface Vector<T> { name: string; input: T; canonical_hex: string; sha256_base64: string; byte_length: number }
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`../../../fixtures/protocol/v1/${name}`, import.meta.url), "utf8"));
const vectors = fixture("vectors.json") as { invoices: Vector<InvoiceV1>[]; identities: Vector<IdentityDescriptorV1>[] };
const invalid = fixture("invalid-invoices.json") as { field: string; value: unknown }[];
const numeric = fixture("numeric-tokens.json") as { field: string; token: string; expected: number | null }[];
const signatures = fixture("signatures.json") as {
  test_seed_hex: string; public_key_base64: string;
  invoices: { vector: string; signature_base64: string }[];
  identities: { vector: string; signature_base64: string }[];
};
const ordinary = vectors.invoices[0]!;
const identity = vectors.identities[0]!;
const invoiceSignature = signatures.invoices[0]!.signature_base64;
const identitySignature = signatures.identities[0]!.signature_base64;
const key = signatures.public_key_base64;
const zeroHash = Buffer.alloc(32).toString("base64");
const alternateHash = Buffer.alloc(32, 123).toString("base64");
const changed = (field: string, value: unknown): InvoiceV1 => ({ ...ordinary.input, [field]: value }) as InvoiceV1;
const publicTestKey = createPrivateKey({
  key: Buffer.from("302e020100300506032b657004220420" + signatures.test_seed_hex, "hex"),
  format: "der", type: "pkcs8",
});

// Produces the same decoded bytes as a valid padded encoding, but invalid unused bits.
function noncanonicalTrailingBits(value: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const position = value.indexOf("=") - 1;
  const next = alphabet[alphabet.indexOf(value[position]!) + 1]!;
  return value.slice(0, position) + next + value.slice(position + 1);
}

describe("canonical codec", () => {
  it.each(vectors.invoices)("matches independent invoice bytes and hash: $name", (vector) => {
    const bytes = encodeInvoice(vector.input);
    expect(Buffer.from(bytes).toString("hex")).toBe(vector.canonical_hex);
    expect(bytes.byteLength).toBe(vector.byte_length);
    expect(invoiceHash(vector.input)).toBe(vector.sha256_base64);
  });

  it.each(vectors.identities)("matches independent descriptor bytes and hash: $name", (vector) => {
    const bytes = encodeIdentityDescriptor(vector.input);
    expect(Buffer.from(bytes).toString("hex")).toBe(vector.canonical_hex);
    expect(bytes.byteLength).toBe(vector.byte_length);
    expect(identityDescriptorHash(vector.input)).toBe(vector.sha256_base64);
  });

  it.each(invalid)("rejects malformed invoice field $field=$value", ({ field, value }) => {
    expect(() => encodeInvoice(changed(field, value))).toThrow(TypeError);
  });

  it.each(numeric)("matches Rust numeric tokens: $field=$token", ({ field, token, expected }) => {
    const value: unknown = JSON.parse(token);
    if (expected === null) {
      expect(() => encodeInvoice(changed(field, value))).toThrow(TypeError);
    } else {
      expect(encodeInvoice(changed(field, value))).toEqual(encodeInvoice(changed(field, expected)));
    }
  });

  it("rejects missing and unsigned extra fields", () => {
    for (const field of Object.keys(ordinary.input)) {
      const value: Record<string, unknown> = { ...ordinary.input };
      delete value[field];
      expect(() => encodeInvoice(value as unknown as InvoiceV1)).toThrow(TypeError);
    }
    expect(() => encodeInvoice(changed("extra_approval", true))).toThrow(TypeError);
    expect(() => encodeInvoice(null as unknown as InvoiceV1)).toThrow(TypeError);
    expect(() => encodeInvoice([] as unknown as InvoiceV1)).toThrow(TypeError);
  });

  it("validates every native account field without trimming", () => {
    for (const field of ["core_account", "owner_id", "service_id", "payout_account"]) {
      for (const value of ["Ab", "ab\n", "ab\r", "ab\u2028", "ab\u2029", "ab.", "a..b", "ab ", "₹₹"]) {
        expect(() => encodeInvoice(changed(field, value))).toThrow(TypeError);
      }
      expect(() => encodeInvoice(changed(field, "a".repeat(64)))).not.toThrow();
      expect(() => encodeInvoice(changed(field, "a".repeat(65)))).toThrow(TypeError);
    }
  });

  it("rejects lossy JavaScript string conversion but preserves valid Unicode", () => {
    for (const field of ["network", "asset", "profile_id"]) {
      for (const value of ["\ud800", "\udc00", "x\ud800y"]) {
        expect(() => encodeInvoice(changed(field, value))).toThrow(TypeError);
      }
    }
    expect(() => encodeInvoice(changed("profile_id", "🧾".repeat(16)))).not.toThrow();
    expect(() => encodeInvoice(changed("profile_id", "🧾".repeat(16) + "x"))).toThrow(TypeError);
    expect(encodeInvoice(changed("profile_id", "é"))).not.toEqual(encodeInvoice(changed("profile_id", "e\u0301")));
  });

  it("does not coerce decimal strings or numeric field types", () => {
    for (const value of ["1\n", "1\r", "1\u2028", "1\u2029", "١", 1n, true]) {
      expect(() => encodeInvoice(changed("amount_yocto", value))).toThrow(TypeError);
    }
    for (const value of [NaN, Infinity, -Infinity, true, null]) {
      expect(() => encodeInvoice(changed("policy_revision", value))).toThrow(TypeError);
    }
    expect(() => encodeInvoice(changed("amount_yocto", "0"))).not.toThrow();
    expect(() => encodeInvoice(changed("expires_at_ns", "18446744073709551616"))).toThrow(TypeError);
  });

  it("validates descriptor fields independently of invoice shape", () => {
    for (const [field, value] of [
      ["challenge_nonce", Buffer.alloc(31).toString("base64")],
      ["invoice_key", Buffer.alloc(33).toString("base64")],
      ["service_version", 2 ** 32], ["core_account", "x"],
      ["network", "\ud800"], ["issued_at_ns", "01"], ["extra", "unsigned"],
    ] as const) {
      expect(() => encodeIdentityDescriptor({ ...identity.input, [field]: value } as IdentityDescriptorV1)).toThrow(TypeError);
    }
  });
});

describe("Ed25519 invoice and descriptor signatures", () => {
  it.each(signatures.invoices)("verifies a committed public-test invoice signature: $vector", (signed) => {
    const vector = vectors.invoices.find((entry) => entry.name === signed.vector)!;
    expect(verifyInvoiceSignature({ invoice: vector.input, signature: signed.signature_base64 }, key)).toBe(true);
  });

  it("verifies a descriptor using the explicitly supplied registry key", () => {
    expect(verifyIdentityDescriptorSignature(identity.input, identitySignature, key)).toBe(true);
  });

  const invoiceMutations: [string, unknown][] = [
    ["schema_version", 2], ["network", "near:mainnet"], ["core_account", "other.testnet"],
    ["owner_id", "other.testnet"], ["session_id", zeroHash], ["payment_id", zeroHash],
    ["policy_revision", 2], ["profile_id", "audit-other"], ["profile_revision", 8],
    ["service_id", "other.testnet"], ["service_version", 4], ["payout_account", "other.testnet"],
    ["endpoint_hash", zeroHash], ["request_hash", zeroHash], ["asset", "OTHER"],
    ["amount_yocto", (BigInt(ordinary.input.amount_yocto) + 1n).toString()],
    ["issued_at_ns", (BigInt(ordinary.input.issued_at_ns) + 1n).toString()],
    ["expires_at_ns", (BigInt(ordinary.input.expires_at_ns) + 1n).toString()],
  ];
  it.each(invoiceMutations)("rejects an unchanged signature after invoice %s mutation", (field, value) => {
    expect(verifyInvoiceSignature({ invoice: changed(field, value), signature: invoiceSignature }, key)).toBe(false);
  });

  const identityMutations: [string, unknown][] = [
    ["schema_version", 2], ["network", "near:mainnet"], ["core_account", "other.testnet"],
    ["challenge_nonce", zeroHash], ["service_id", "other.testnet"], ["service_version", 4],
    ["payout_account", "other.testnet"], ["endpoint_hash", zeroHash], ["invoice_key", zeroHash],
    ["issued_at_ns", "0"], ["expires_at_ns", "1"],
  ];
  it.each(identityMutations)("rejects an unchanged signature after descriptor %s mutation", (field, value) => {
    const descriptor = { ...identity.input, [field]: value } as IdentityDescriptorV1;
    expect(verifyIdentityDescriptorSignature(descriptor, identitySignature, key)).toBe(false);
  });

  it("rejects domain substitution in both directions", () => {
    expect(verifyInvoiceSignature({ invoice: ordinary.input, signature: identitySignature }, key)).toBe(false);
    expect(verifyIdentityDescriptorSignature(identity.input, invoiceSignature, key)).toBe(false);
  });

  it("requires the registered key and never trusts the descriptor key", () => {
    const selfSigned = { ...identity.input, invoice_key: key };
    const signature = sign(null, encodeIdentityDescriptor(selfSigned), publicTestKey).toString("base64");
    expect(verifyIdentityDescriptorSignature(selfSigned, signature, alternateHash)).toBe(false);
    expect(verifyIdentityDescriptorSignature(selfSigned, signature, undefined as unknown as string)).toBe(false);
    expect(verifyInvoiceSignature({ invoice: ordinary.input, signature: invoiceSignature }, alternateHash)).toBe(false);
  });

  it("rejects altered signatures and noncanonical encodings of valid signatures", () => {
    const altered = Buffer.from(invoiceSignature, "base64");
    altered[0] = altered[0]! ^ 1;
    for (const signature of [
      altered.toString("base64"), Buffer.alloc(63).toString("base64"), Buffer.alloc(65).toString("base64"),
      invoiceSignature.trimEnd() + "\n", invoiceSignature.replace(/=+$/, ""),
      invoiceSignature.replaceAll("+", "-").replaceAll("/", "_"), noncanonicalTrailingBits(invoiceSignature),
    ]) {
      expect(verifyInvoiceSignature({ invoice: ordinary.input, signature }, key)).toBe(false);
    }
    for (const invalidKey of [key + "\n", key.replace(/=+$/, ""), noncanonicalTrailingBits(key), zeroHash.slice(0, -1)]) {
      expect(verifyInvoiceSignature({ invoice: ordinary.input, signature: invoiceSignature }, invalidKey)).toBe(false);
    }
  });

  it("does not sign a digest or JSON serialization instead of the canonical bytes", () => {
    for (const message of [Buffer.from(invoiceHash(ordinary.input), "base64"), Buffer.from(JSON.stringify(ordinary.input))]) {
      const signature = sign(null, message, publicTestKey).toString("base64");
      expect(verifyInvoiceSignature({ invoice: ordinary.input, signature }, key)).toBe(false);
    }
  });

  it("rejects unrecognized signed-wrapper fields", () => {
    const quote = { invoice: ordinary.input, signature: invoiceSignature, approval: true } as SignedInvoiceV1;
    expect(verifyInvoiceSignature(quote, key)).toBe(false);
    expect(verifyInvoiceSignature(null as unknown as SignedInvoiceV1, key)).toBe(false);
  });

  it.each([0, 1])("rejects a weak public key and identity-point forgery: %s", (firstByte) => {
    const weakKey = Buffer.alloc(32);
    weakKey[0] = firstByte;
    const forged = Buffer.alloc(64);
    forged[0] = 1; // R is the identity point; S is zero.
    expect(verifyInvoiceSignature({ invoice: ordinary.input, signature: forged.toString("base64") }, weakKey.toString("base64"))).toBe(false);
  });

  it("rejects an equivalent noncanonical signature scalar", () => {
    const modified = Buffer.from(invoiceSignature, "base64");
    const groupOrder = (1n << 252n) + 27742317777372353535851937790883648493n;
    let scalar = 0n;
    for (let index = 63; index >= 32; index--) scalar = (scalar << 8n) + BigInt(modified[index]!);
    scalar += groupOrder;
    for (let index = 32; index < 64; index++) {
      modified[index] = Number(scalar & 255n);
      scalar >>= 8n;
    }
    expect(verifyInvoiceSignature({ invoice: ordinary.input, signature: modified.toString("base64") }, key)).toBe(false);
  });
});

describe("invoice audit request hash", () => {
  it("matches an independent Python digest of exact UTF-8 bytes", () => {
    expect(requestHash("vendor_id,invoice_id,amount,currency\nv1,i1,1.25,USD\n")).toBe("ku1l5WFENWyRgV2CkF4r+1d480j4ZKz5bz3jlzJZR8g=");
    expect(requestHash("v,₹,1.25,INR\r\n")).toBe("w/Z1d456EBHPFQdY1gB3tl0BibQ0OXWreuMbi7RoBPw=");
  });

  it("does not normalize newlines, whitespace, BOM or Unicode", () => {
    const original = requestHash("v,i,1,USD\n");
    for (const input of ["v,i,1,USD\r\n", " v,i,1,USD\n", "\ufeffv,i,1,USD\n"]) {
      expect(requestHash(input)).not.toBe(original);
    }
    expect(requestHash("é")).not.toBe(requestHash("e\u0301"));
  });

  it("bounds raw UTF-8 input at 64KiB and rejects malformed strings", () => {
    expect(requestHash("a".repeat(65536))).toHaveLength(44);
    expect(() => requestHash("a".repeat(65537))).toThrow(TypeError);
    expect(() => requestHash("🧾".repeat(16385))).toThrow(TypeError);
    expect(() => requestHash("\ud800")).toThrow(TypeError);
    expect(() => requestHash(1 as unknown as string)).toThrow(TypeError);
  });
});
