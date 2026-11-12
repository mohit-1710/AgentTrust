import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { invoiceHash, validateAccountId, validateHash32, validateSignedInvoice, verifyInvoiceSignature } from "./codec.js";
import { validateDecision } from "./finality.js";
import type { SignedInvoiceV1 } from "./types.js";
import type { CredentialRef, Decision, TransactionLocator } from "./views.js";
export interface AttemptContext {
  network: "near:testnet"; core_account: string; owner_id: string;
  service_id: string; request_hash: string; payment_id: string;
}
export interface SavedAttempt {
  schema_version: 1; context: AttemptContext; quote: SignedInvoiceV1;
  invoice_hash: string; invoice_key: string; credential: CredentialRef | null;
}
export type AttemptCheckpoint = { schema_version: 1; invoice_hash: string } & (
  { kind: "preview_rejection"; decision: Exclude<Decision, { kind: "allow" }> } |
  { kind: "submission"; transaction: TransactionLocator }
);
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
const hasCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && "code" in error && error.code === code;
function checkContext(context: AttemptContext): void {
  if (!exact(context, ["network", "core_account", "owner_id", "service_id", "request_hash", "payment_id"]) || context.network !== "near:testnet") throw new Error("INVALID_ATTEMPT_CONTEXT");
  validateAccountId(context.core_account); validateAccountId(context.owner_id); validateAccountId(context.service_id);
  validateHash32(context.request_hash); validateHash32(context.payment_id);
}
export function validateCredentialRef(value: unknown): asserts value is CredentialRef | null {
  if (value === null) return;
  if (!exact(value, ["issuer_id", "credential_id", "revision"]) || !Number.isInteger(value.revision) || (value.revision as number) < 1 || (value.revision as number) > 0xffffffff) throw new Error("INVALID_CREDENTIAL_REF");
  validateAccountId(value.issuer_id as string); validateHash32(value.credential_id as string);
}
export function validateTransactionLocator(value: unknown, owner: string): asserts value is TransactionLocator {
  if (!exact(value, ["tx_hash", "sender_account_id"]) || value.sender_account_id !== owner || typeof value.tx_hash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.tx_hash)) throw new Error("INVALID_TRANSACTION_LOCATOR");
}
function checkAttempt(value: unknown): SavedAttempt {
  try {
    if (!exact(value, ["schema_version", "context", "quote", "invoice_hash", "invoice_key", "credential"]) || value.schema_version !== 1) throw new Error();
    const saved = value as unknown as SavedAttempt;
    checkContext(saved.context); validateSignedInvoice(saved.quote); validateHash32(saved.invoice_key); validateCredentialRef(saved.credential);
    const invoice = saved.quote.invoice;
    if (Object.entries(saved.context).some(([field, entry]) => invoice[field as keyof typeof invoice] !== entry) ||
        invoiceHash(invoice) !== saved.invoice_hash || !verifyInvoiceSignature(saved.quote, saved.invoice_key)) throw new Error();
    return saved;
  } catch { throw new Error("INVALID_ATTEMPT"); }
}
function checkCheckpoint(value: unknown, attempt: SavedAttempt): AttemptCheckpoint {
  try {
    if (!exact(value, ["schema_version", "invoice_hash", "kind", value !== null && typeof value === "object" && "kind" in value && value.kind === "submission" ? "transaction" : "decision"]) || value.schema_version !== 1 || value.invoice_hash !== attempt.invoice_hash) throw new Error();
    if (value.kind === "submission") validateTransactionLocator(value.transaction, attempt.context.owner_id);
    else {
      if (value.kind !== "preview_rejection") throw new Error();
      const decision = validateDecision(value.decision);
      if (decision.kind === "allow") throw new Error();
      if (decision.kind === "deny") {
        if (!exact(decision, decision.retry_after_ns === undefined ? ["kind", "code"] : ["kind", "code", "retry_after_ns"])) throw new Error();
      } else if (!exact(decision, ["kind", "code", "requirement"]) || !exact(decision.requirement, ["capability_namespace", "capability_version", "conformance_suite_version", "conformance_suite_hash", "accepted_issuers"])) throw new Error();
    }
    return value as unknown as AttemptCheckpoint;
  } catch { throw new Error("INVALID_CHECKPOINT"); }
}

/** Ordinary immutable JSON files. One checkpoint wins; no database or mutable replay cache. */
export class AttemptJournal {
  readonly directory: string;
  constructor(directory: string) {
    if (!isAbsolute(directory)) throw new Error("INVALID_JOURNAL_PATH");
    this.directory = resolve(directory);
  }
  private async ready(): Promise<void> {
    // The configured parent must already exist. Sync it even on a later load:
    // an interrupted first mkdir must not make a later broadcast nondurable.
    try { await fs.mkdir(this.directory, { mode: 0o700 }); }
    catch (error) { if (!hasCode(error, "EEXIST")) throw error; }
    const stat = await fs.lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 || process.getuid && stat.uid !== process.getuid()) throw new Error("UNSAFE_JOURNAL");
    await this.syncDirectory(await fs.realpath(dirname(this.directory)));
  }
  private path(context: AttemptContext, suffix: "attempt" | "checkpoint"): string {
    checkContext(context);
    const key = createHash("sha256").update("AGENTTRUST_ATTEMPT_V1\0").update(JSON.stringify([context.network, context.core_account, context.owner_id, context.payment_id])).digest("hex");
    return join(this.directory, `${key}.${suffix}.json`);
  }
  private async syncDirectory(directory = this.directory): Promise<void> {
    const handle = await fs.open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await handle.sync(); } finally { await handle.close(); }
  }
  private async read(path: string): Promise<unknown | null> {
    await this.ready();
    let handle: fs.FileHandle;
    try { handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (hasCode(error, "ENOENT")) return null; throw error; }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 32 * 1024 || (stat.mode & 0o777) !== 0o600 || process.getuid && stat.uid !== process.getuid()) throw new Error("INVALID_JOURNAL_FILE");
      const bytes = await handle.readFile();
      if (bytes.length > 32 * 1024) throw new Error("INVALID_JOURNAL_FILE");
      // A prior process may have crashed after publication but before directory
      // fsync. Re-establish durability on every load before any possible send.
      await handle.sync(); await this.syncDirectory();
      return JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
    } finally { await handle.close(); }
  }
  private async publish(path: string, value: unknown): Promise<boolean> {
    await this.ready();
    const temporary = join(this.directory, `.publish-${randomUUID()}.tmp`);
    const bytes = Buffer.from(JSON.stringify(value) + "\n");
    if (bytes.length > 32 * 1024) throw new Error("INVALID_JOURNAL_FILE");
    try {
      const handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      try { await fs.link(temporary, path); }
      catch (error) { if (hasCode(error, "EEXIST")) return false; throw error; }
      await this.syncDirectory();
      return true;
    } finally { await fs.unlink(temporary).catch((error: unknown) => { if (!hasCode(error, "ENOENT")) throw error; }); }
  }
  async load(context: AttemptContext): Promise<SavedAttempt | null> {
    const value = await this.read(this.path(context, "attempt"));
    if (value === null) return null;
    const saved = checkAttempt(value);
    if (Object.entries(context).some(([field, entry]) => saved.context[field as keyof AttemptContext] !== entry)) throw new Error("ATTEMPT_CONFLICT");
    return saved;
  }
  async save(candidate: SavedAttempt): Promise<SavedAttempt> {
    candidate = checkAttempt(structuredClone(candidate));
    await this.publish(this.path(candidate.context, "attempt"), candidate);
    const saved = await this.load(candidate.context);
    if (!saved) throw new Error("JOURNAL_DISAPPEARED");
    return saved; // Concurrent identical operation always adopts the winning quote.
  }
  async checkpoint(attempt: SavedAttempt): Promise<AttemptCheckpoint | null> {
    const value = await this.read(this.path(attempt.context, "checkpoint"));
    return value === null ? null : checkCheckpoint(value, attempt);
  }
  async claim(attempt: SavedAttempt, candidate: AttemptCheckpoint): Promise<{ checkpoint: AttemptCheckpoint; created: boolean }> {
    candidate = checkCheckpoint(structuredClone(candidate), attempt);
    const saved = await this.load(attempt.context);
    if (!saved || saved.invoice_hash !== attempt.invoice_hash) throw new Error("ATTEMPT_CONFLICT");
    const created = await this.publish(this.path(attempt.context, "checkpoint"), candidate);
    const checkpoint = await this.checkpoint(attempt);
    if (!checkpoint) throw new Error("JOURNAL_DISAPPEARED");
    return { checkpoint, created };
  }
}
