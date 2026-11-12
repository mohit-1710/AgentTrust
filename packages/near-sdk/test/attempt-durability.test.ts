import { generateKeyPairSync, sign } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("node:fs/promises", async (original) => { const actual = await original<typeof import("node:fs/promises")>(); return { ...actual, open: vi.fn(actual.open), link: vi.fn(actual.link) }; });
import * as fs from "node:fs/promises";
import { AttemptJournal, type SavedAttempt } from "../src/attempts.js";
import { encodeInvoice, invoiceHash } from "../src/codec.js";
import { quote } from "../../../examples/invoice-audit/test/paid-fixtures.js";

const paths: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(paths.splice(0).map((path) => fs.rm(path, { recursive: true, force: true }))); });
it("does not authorize broadcast after failed publication fsync and re-syncs the original checkpoint on recovery", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "agenttrust-fsync-")); paths.push(root);
  const directory = join(await fs.realpath(root), "attempts"), store = new AttemptJournal(directory);
  const keys = generateKeyPairSync("ed25519"), invoice = quote().invoice;
  const saved: SavedAttempt = { schema_version: 1, context: { network: invoice.network, core_account: invoice.core_account, owner_id: invoice.owner_id, service_id: invoice.service_id, request_hash: invoice.request_hash, payment_id: invoice.payment_id }, quote: { invoice, signature: sign(null, encodeInvoice(invoice), keys.privateKey).toString("base64") }, invoice_hash: invoiceHash(invoice), invoice_key: keys.publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64"), credential: null };
  await store.save(saved);
  const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  let afterLink = false, failedOnce = false, recoverySyncs = 0;
  vi.mocked(fs.link).mockImplementation(async (source, target) => { await real.link(source, target); if (String(target).endsWith(".checkpoint.json")) afterLink = true; });
  vi.mocked(fs.open).mockImplementation(async (...args) => {
    const handle = await real.open(...args);
    if (String(args[0]) === directory) {
      const sync = handle.sync.bind(handle);
      handle.sync = async () => { if (afterLink && !failedOnce) { failedOnce = true; throw new Error("publication fsync failed"); } if (failedOnce) recoverySyncs++; return sync(); };
    }
    return handle;
  });
  const original = { schema_version: 1 as const, invoice_hash: saved.invoice_hash, kind: "submission" as const, transaction: { tx_hash: "1".repeat(32), sender_account_id: saved.context.owner_id } };
  await expect(store.claim(saved, original)).rejects.toThrow("publication fsync failed");
  expect(await new AttemptJournal(directory).checkpoint(saved)).toEqual(original);
  expect(recoverySyncs).toBeGreaterThan(0);
  const next = await store.claim(saved, { ...original, transaction: { ...original.transaction, tx_hash: "2".repeat(32) } });
  expect(next).toEqual({ created: false, checkpoint: original });
});
