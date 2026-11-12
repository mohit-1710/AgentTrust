import { generateKeyPairSync, sign } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { AttemptJournal, type SavedAttempt } from "../src/attempts.js";
import { encodeInvoice, invoiceHash, requestHash } from "../src/codec.js";
import { endpointHash } from "../src/directory.js";
import type { InvoiceV1 } from "../src/types.js";

const keys = generateKeyPairSync("ed25519");
const invoice_key = keys.publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64");
const hash = (value: number) => Buffer.alloc(32, value).toString("base64");
function attempt(issued = "1000"): SavedAttempt {
  const invoice: InvoiceV1 = { schema_version: 1, network: "near:testnet", core_account: "core.testnet", owner_id: "owner.testnet", session_id: hash(1), payment_id: hash(2), policy_revision: 1, profile_id: "audit", profile_revision: 1, service_id: "audit.testnet", service_version: 1, payout_account: "payee.testnet", endpoint_hash: endpointHash("https://audit.example"), request_hash: requestHash("private CSV"), asset: "NEAR", amount_yocto: "10", issued_at_ns: issued, expires_at_ns: "10000000000" };
  return { schema_version: 1, context: { network: invoice.network, core_account: invoice.core_account, owner_id: invoice.owner_id, service_id: invoice.service_id, request_hash: invoice.request_hash, payment_id: invoice.payment_id }, invoice_hash: invoiceHash(invoice), invoice_key, credential: null, quote: { invoice, signature: sign(null, encodeInvoice(invoice), keys.privateKey).toString("base64") } };
}
const paths: string[] = [];
async function journal() { const path = await fs.mkdtemp(join(tmpdir(), "agenttrust-journal-")); paths.push(path); return new AttemptJournal(join(await fs.realpath(path), "attempts")); }
afterEach(async () => { await Promise.all(paths.splice(0).map((path) => fs.rm(path, { recursive: true, force: true }))); });

describe("durable exact-attempt journal", () => {
  it("persists exact signed bytes privately without CSV or a secret, and survives a new instance", async () => {
    const store = await journal(); const saved = attempt();
    expect(await store.load(saved.context)).toBeNull();
    expect(await store.save(saved)).toEqual(saved);
    expect(await new AttemptJournal(store.directory).load(saved.context)).toEqual(saved);
    expect((await fs.stat(store.directory)).mode & 0o777).toBe(0o700);
    const files = await fs.readdir(store.directory); expect(files).toHaveLength(1);
    expect((await fs.stat(join(store.directory, files[0]!))).mode & 0o777).toBe(0o600);
    expect(await fs.readFile(join(store.directory, files[0]!), "utf8")).not.toMatch(/private CSV|privateKey|secret|csv_utf8/);
  });
  it("publishes one winning exact quote under concurrent writers without clobbering it", async () => {
    const store = await journal();
    const values = await Promise.all(Array.from({ length: 12 }, (_, i) => new AttemptJournal(store.directory).save(attempt(String(1000 + i)))));
    expect(new Set(values.map((value) => value.invoice_hash)).size).toBe(1);
    expect(await store.load(attempt().context)).toEqual(values[0]);
    expect(await fs.readdir(store.directory)).toHaveLength(1);
  });
  it.each(["service_id", "request_hash"] as const)("rejects same-ID different %s without overwriting", async (field) => {
    const store = await journal(); const saved = await store.save(attempt());
    const context = { ...saved.context, [field]: field === "service_id" ? "other.testnet" : hash(9) };
    await expect(store.load(context)).rejects.toThrow("ATTEMPT_CONFLICT");
    expect(await store.load(saved.context)).toEqual(saved);
  });
  it("uses one atomic slot for a preview refusal or a broadcast locator", async () => {
    const store = await journal(); const saved = await store.save(attempt());
    const submission = { schema_version: 1 as const, invoice_hash: saved.invoice_hash, kind: "submission" as const, transaction: { tx_hash: "1".repeat(32), sender_account_id: saved.context.owner_id } };
    const rejection = { schema_version: 1 as const, invoice_hash: saved.invoice_hash, kind: "preview_rejection" as const, decision: { kind: "deny" as const, code: "RATE_LIMIT" as const } };
    const results = await Promise.all([store.claim(saved, submission), store.claim(saved, rejection), store.claim(saved, submission)]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.every((result) => JSON.stringify(result.checkpoint) === JSON.stringify(results[0]!.checkpoint))).toBe(true);
    expect(await new AttemptJournal(store.directory).checkpoint(saved)).toEqual(results[0]!.checkpoint);
  });
  it("refuses insecure directories, symlink files, oversized and malformed journal data", async () => {
    const store = await journal(); const saved = await store.save(attempt());
    await fs.chmod(store.directory, 0o755);
    await expect(store.load(saved.context)).rejects.toThrow("UNSAFE_JOURNAL");
    await fs.chmod(store.directory, 0o700);
    const file = join(store.directory, (await fs.readdir(store.directory))[0]!);
    await fs.writeFile(file, JSON.stringify({ ...saved, csv_utf8: "private" }));
    await expect(store.load(saved.context)).rejects.toThrow("INVALID_ATTEMPT");
    await fs.writeFile(file, " ".repeat(32769));
    await expect(store.load(saved.context)).rejects.toThrow("INVALID_JOURNAL_FILE");
    await fs.unlink(file); await fs.symlink("/does-not-exist", file);
    await expect(store.load(saved.context)).rejects.toThrow();
  });
  it("rejects malformed IDs, tampered invoice hashes/signatures and cross-attempt checkpoint binding", async () => {
    const store = await journal(); const saved = attempt();
    await expect(store.load({ ...saved.context, payment_id: "../escape" })).rejects.toThrow();
    await expect(store.save({ ...saved, invoice_hash: hash(9) })).rejects.toThrow("INVALID_ATTEMPT");
    await expect(store.save({ ...saved, quote: { ...saved.quote, signature: Buffer.alloc(64).toString("base64") } })).rejects.toThrow("INVALID_ATTEMPT");
    await store.save(saved);
    await expect(store.claim(saved, { schema_version: 1, invoice_hash: hash(9), kind: "submission", transaction: { tx_hash: "1".repeat(32), sender_account_id: saved.context.owner_id } })).rejects.toThrow("INVALID_CHECKPOINT");
  });
  it("does not persist extra response fields inside a preview decision", async () => {
    const store = await journal(); const saved = await store.save(attempt());
    await expect(store.claim(saved, { schema_version: 1, invoice_hash: saved.invoice_hash, kind: "preview_rejection", decision: { kind: "deny", code: "RATE_LIMIT", csv_utf8: "private" } as never })).rejects.toThrow("INVALID_CHECKPOINT");
    expect(await store.checkpoint(saved)).toBeNull();
  });
});
