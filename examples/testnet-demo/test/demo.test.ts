import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baseEncode, KeyPairSigner } from "near-api-js";
import { argumentsFor, publicTemplate, renderPublicConfigs, requirement, service, sha256, validateConfig, type DemoConfig } from "../src/config.js";
import { Capture, finalTransaction, publicOnly } from "../src/capture.js";
import { checkTestnetEvidence } from "../src/check.js";
import { OperationJournal } from "../src/operations.js";
import { runPreparation } from "../src/prepare.js";
import { requirePaid, requireRejected, runDemo } from "../src/run.js";
import type { PaidAuditResult } from "../../../packages/near-sdk/src/pay-service.js";
import type { SubmissionResult } from "../../../packages/near-sdk/src/views.js";
import { AgentTrustClient } from "../../../packages/near-sdk/src/client.js";
import { AttemptJournal } from "../../../packages/near-sdk/src/attempts.js";
import { invoiceHash, requestHash } from "../../../packages/near-sdk/src/codec.js";
import { loadConformanceSuite } from "../../invoice-audit/src/conformance.js";
import { PAID_PROTOCOL } from "../../../packages/near-sdk/src/paid-protocol.js";
import type { InvoiceV1 } from "../../../packages/near-sdk/src/types.js";

const b64 = (n: number) => Buffer.alloc(32, n).toString("base64");
const config = (): DemoConfig => ({ schema_version: 1, network: "near:testnet", rpc_url: "https://rpc.testnet.near.org", core_account: "core.testnet", expected_wasm_sha256: "ab".repeat(32), owner_id: "owner.testnet", issuer_id: "issuer.testnet", worker_public_key: `ed25519:${baseEncode(Buffer.alloc(32, 1))}`, session_id: b64(1), profile_id: "invoice-audit", session_expires_at_ns: "2000000000000000000", credential_id: b64(2), credential_expires_at_ns: "2000000000000000000", attempts_directory: "/tmp/agenttrust-unit-attempts", rotated_payout_account: "rotated.testnet", providers: { a: { service_id: "alpha.testnet", payout_account: "alpha-pay.testnet", invoice_key: b64(3), origin: "https://localhost:4041", amount_yocto: "2000000000000000000000", port: 4041 }, b: { service_id: "beta.testnet", payout_account: "beta-pay.testnet", invoice_key: b64(4), origin: "https://localhost:4042", amount_yocto: "2000000000000000000000", port: 4042 } }, payment_ids: { missing: b64(10), paid: b64(11), revoked: b64(12), identity: b64(13) } });
const folders: string[] = [];
async function folder() { const dir = await mkdtemp(path.join(tmpdir(), "agenttrust-demo-unit-")); folders.push(dir); return dir; }
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await Promise.all(folders.splice(0).map((d) => rm(d, { recursive: true, force: true }))); });
describe("public preparation and effect boundaries", () => {
  it("the documented config block preserves existing IDs when pasted again", async () => {
    const dir = await folder(); await mkdir(path.join(dir, ".agenttrust"));
    const book = await readFile(new URL("../../../docs/testnet-demo-runbook.md", import.meta.url), "utf8");
    const block = book.match(/^export AGENTTRUST_DEMO_DIR=.*?\n[\s\S]*?(?=^```)/m)![0];
    // Execute only the public file-preparation excerpt; stub pnpm so no build, keys or network can run.
    const shell = `pnpm() { print -r -- '{"generated":"unit-fixture"}'; }\n${block}`;
    expect(spawnSync("/bin/zsh", ["-c", shell], { cwd: dir }).status).toBe(0);
    const file = path.join(dir, ".agenttrust/testnet-demo-1/demo.json"), original = '{"payment_ids":{"paid":"operator-original-id"}}\n';
    await writeFile(file, original);
    const repeated = spawnSync("/bin/zsh", ["-c", shell], { cwd: dir });
    expect(await readFile(file, "utf8")).toBe(original); expect(repeated.status).not.toBe(0);
  });
  it("the documented config block creates its parent and keeps the export outside its subshell", async () => {
    const dir = await folder(), book = await readFile(new URL("../../../docs/testnet-demo-runbook.md", import.meta.url), "utf8");
    const block = book.match(/^export AGENTTRUST_DEMO_DIR=.*?\n[\s\S]*?(?=^```)/m)![0];
    const result = spawnSync("/bin/zsh", ["-c", `pnpm() { print -r -- '{}'; }\n${block}\n[[ "$AGENTTRUST_DEMO_DIR" == "$PWD/.agenttrust/testnet-demo-1" ]]`], { cwd: dir });
    expect(result.status).toBe(0); expect(await readFile(path.join(dir, ".agenttrust/testnet-demo-1/demo.json"), "utf8")).toBe("{}\n");
  });
  it("validates an exact two-provider config and emits only public role files", () => {
    const c = validateConfig(config()); const rendered = renderPublicConfigs(c);
    expect(rendered.provider_a.offer.service.service_id).toBe(c.providers.a.service_id);
    expect(rendered.mcp.credentials[0]!.credential.issuer_id).toBe(c.issuer_id);
    expect(JSON.stringify(rendered)).not.toMatch(/PRIVATE_KEY|SEED_BASE64/);
    expect(() => validateConfig(publicTemplate(1))).toThrow();
  });
  it.each([
    (c: any) => c.network = "near:mainnet", (c: any) => c.private_key = "secret", (c: any) => c.rpc_url = "https://secret@rpc.testnet.near.org",
    (c: any) => c.attempts_directory = "relative", (c: any) => c.providers.a.origin = "http://localhost:4041", (c: any) => c.providers.a.origin = "https://localhost:4041/path",
    (c: any) => c.providers.a.service_id = c.owner_id, (c: any) => c.payment_ids.paid = c.payment_ids.missing,
  ])("rejects unsafe or ambiguous config %s", (change) => { const c = config(); change(c); expect(() => validateConfig(c)).toThrow(); });
  it("refuses operational arguments before config, key, network or writes", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(runPreparation(["--config", "/missing"])).rejects.toThrow("EXPLICIT_USER_RUN_ARGUMENTS_REQUIRED");
    await expect(runDemo([])).rejects.toThrow("EXPLICIT_USER_RUN_ARGUMENTS_REQUIRED");
    expect(() => argumentsFor(["--user-run", "--config", "/c", "--output", "o", "--step", "other"], ["purchase"])).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("launcher isolates worker and setup credentials and rejects unflagged operations", async () => {
    const { isolatedEnvironment, launchArguments } = await import(new URL("../../../scripts/run-demo.mjs", import.meta.url).href);
    const env = { PATH: "/bin", HOME: "/wallet", NODE_OPTIONS: "--require=/bad", NODE_TLS_REJECT_UNAUTHORIZED: "0", NODE_EXTRA_CA_CERTS: "/explicit.pem", AGENTTRUST_WORKER_PRIVATE_KEY: "worker", AGENTTRUST_SETUP_PRIVATE_KEY: "owner", AGENTTRUST_INVOICE_SEED_BASE64: "invoice", AWS_SECRET_ACCESS_KEY: "aws", DATABASE_URL: "db" };
    expect(isolatedEnvironment("run", env)).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.pem", AGENTTRUST_WORKER_PRIVATE_KEY: "worker" });
    expect(isolatedEnvironment("prepare", env)).toEqual({ PATH: "/bin", NODE_EXTRA_CA_CERTS: "/explicit.pem", AGENTTRUST_SETUP_PRIVATE_KEY: "owner" });
    expect(() => launchArguments(["run", "--config", "/cfg"])).toThrow("EXPLICIT_USER_RUN_REQUIRED");
    expect(launchArguments(["run", "--", "--help"]).args).toEqual(["--help"]);
  });
});
describe("transaction evidence and nonrepeatable operations", () => {
  it.each(["resume", "observe-retry", "observe-missing-credential", "observe-revoked-credential", "observe-changed-identity"])("%s recovers without any key, signer construction, quote request or executePayment", async (step) => {
    vi.stubEnv("AGENTTRUST_WORKER_PRIVATE_KEY", undefined); vi.stubEnv("AGENTTRUST_SETUP_PRIVATE_KEY", undefined); vi.stubEnv("AGENTTRUST_INVOICE_SEED_BASE64", undefined);
    const c = config(), dir = await folder(), file = path.join(dir, "public.json"); await writeFile(file, JSON.stringify(c));
    const fixture = loadConformanceSuite().fixtures.find((f) => f.fixture_id === "mixed-validity")!;
    const paidCase = step === "resume" || step === "observe-retry", label = step === "observe-missing-credential" ? "a" : "b";
    const id = paidCase ? c.payment_ids.paid : step === "observe-missing-credential" ? c.payment_ids.missing : step === "observe-revoked-credential" ? c.payment_ids.revoked : c.payment_ids.identity;
    const invoice: InvoiceV1 = { schema_version: 1, network: c.network, core_account: c.core_account, owner_id: c.owner_id, session_id: c.session_id, payment_id: id, policy_revision: 1, profile_id: c.profile_id, profile_revision: 1, service_id: c.providers[label].service_id, service_version: 1, payout_account: c.providers[label].payout_account, endpoint_hash: service(c, label).endpoint_hash, request_hash: requestHash(fixture.csv_utf8), asset: "NEAR", amount_yocto: c.providers[label].amount_yocto, issued_at_ns: "1", expires_at_ns: "2" };
    const saved = { schema_version: 1 as const, context: { network: c.network, core_account: c.core_account, owner_id: c.owner_id, service_id: invoice.service_id, request_hash: invoice.request_hash, payment_id: id }, quote: { invoice, signature: Buffer.alloc(64).toString("base64") }, invoice_hash: invoiceHash(invoice), invoice_key: c.providers[label].invoice_key, credential: null };
    const transaction = { tx_hash: baseEncode(Buffer.alloc(32, 8)), sender_account_id: c.owner_id };
    const payment = { invoice, invoice_hash: saved.invoice_hash, credential: null, dispatched_at_ns: "2", dispatch_day: "0", dispatch_minute: "0", state: "settled" as const, finalized_at_ns: "3", display_state: "settled" as const };
    const block = { finality: "final" as const, block_hash: "unit-final-block", block_height: 1 };
    const capture = { put: vi.fn(), checkCore: vi.fn(), query: vi.fn().mockResolvedValue({ amount: "100" }), beforeBroadcast: vi.fn(), transaction: vi.fn(), finish: vi.fn(), unresolvedBroadcast: false };
    vi.spyOn(Capture, "start").mockResolvedValue(capture as unknown as Capture);
    // Journal/RPC doubles are ordinary values; real payService recovery and output checks still run.
    vi.spyOn(AttemptJournal.prototype, "load").mockResolvedValue(saved);
    vi.spyOn(AttemptJournal.prototype, "checkpoint").mockResolvedValue({ schema_version: 1, kind: "submission", invoice_hash: saved.invoice_hash, transaction });
    vi.spyOn(OperationJournal.prototype, "existing").mockResolvedValue(transaction);
    vi.spyOn(AgentTrustClient.prototype, "getPaymentSnapshot").mockResolvedValue({ value: paidCase ? payment : null, block });
    vi.spyOn(AgentTrustClient.prototype, "getPayment").mockResolvedValue(paidCase ? payment : null);
    vi.spyOn(AgentTrustClient.prototype, "awaitPayment").mockResolvedValue({ kind: "settled", payment, block });
    vi.spyOn(AgentTrustClient.prototype, "resolveSubmission").mockResolvedValue({ kind: "final", transaction, receipt_ids: ["unit-receipt"], admission: paidCase ? { kind: "payment", payment, duplicate: true } : { kind: "rejected", decision: step === "observe-changed-identity" ? { kind: "deny", code: "IDENTITY_CHANGED" } : { kind: "require_validation", code: step === "observe-revoked-credential" ? "REVOKED" : "MISSING", requirement: requirement(c) } } });
    const execute = vi.spyOn(AgentTrustClient.prototype, "executePayment").mockRejectedValue(new Error("RECOVERY_ATTEMPTED_EXECUTION"));
    const constructSigner = vi.spyOn(KeyPairSigner, "fromSecretKey");
    const fetcher = vi.fn(async (_url: unknown, options: RequestInit) => { expect(JSON.parse(options.body as string).mode).toBe("redeem"); return new Response(JSON.stringify({ protocol: PAID_PROTOCOL, invoice_hash: saved.invoice_hash, report: fixture.golden }), { headers: { "content-type": "application/json" } }); });
    vi.stubGlobal("fetch", fetcher);
    await expect(runDemo(["--user-run", "--config", file, "--output", "artifacts/local/testnet/unit-observation", "--step", step])).resolves.toBeUndefined();
    expect(capture.finish).toHaveBeenCalledWith("passed", expect.objectContaining({ observation_only: true }), undefined);
    expect(constructSigner).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(paidCase ? 1 : 0);
  });
  it("keeps the same transaction across capture/config changes and refuses a second claim", async () => {
    const c = config(); c.attempts_directory = path.join(await folder(), "attempts");
    const tx = { tx_hash: baseEncode(Buffer.alloc(32, 5)), sender_account_id: c.owner_id };
    const first = new OperationJournal(c, "owner-deposit", c.owner_id);
    expect(await first.existing()).toBeNull(); await first.claim(tx);
    const resumed = new OperationJournal({ ...c, session_id: b64(22) }, "owner-deposit", c.owner_id);
    expect(await resumed.existing()).toEqual(tx);
    await expect(resumed.claim({ ...tx, tx_hash: baseEncode(Buffer.alloc(32, 6)) })).rejects.toThrow();
    expect(await first.existing()).toEqual(tx);
  });
  it("refuses symlinked operation journals", async () => {
    const dir = await folder(), c = config(); c.attempts_directory = path.join(dir, "alias");
    await symlink(dir, c.attempts_directory);
    await expect(new OperationJournal(c, "purchase", c.owner_id).existing()).rejects.toThrow("UNSAFE_OPERATION_DIRECTORY");
  });
  it.each(["uncertain", "retrieval_failed", "denied", "failed"])("does not call %s a checked paid result", (kind) => { expect(() => requirePaid({ kind } as PaidAuditResult, b64(1))).toThrow("PAID_RESULT_REQUIRED"); });
  it("requires explicit FINAL bound transaction/receipts and an executed rejection", () => {
    const tx = { tx_hash: baseEncode(Buffer.alloc(32, 5)), sender_account_id: "owner.testnet" };
    const raw = { final_execution_status: "FINAL", transaction: { hash: tx.tx_hash, signer_id: tx.sender_account_id }, transaction_outcome: { id: tx.tx_hash }, status: { SuccessValue: "" }, receipts_outcome: [{ id: "receipt", outcome: { executor_id: "core.testnet", status: { SuccessValue: "" } } }] };
    expect(() => finalTransaction(raw, tx)).not.toThrow();
    expect(() => finalTransaction({ ...raw, final_execution_status: "INCLUDED" }, tx)).toThrow();
    expect(() => finalTransaction({ ...raw, transaction_outcome: { id: "different" } }, tx)).toThrow();
    expect(() => requireRejected({ kind: "uncertain" } as SubmissionResult, "MISSING")).toThrow();
    expect(() => requireRejected({ kind: "final", admission: { kind: "rejected", decision: { kind: "deny", code: "IDENTITY_CHANGED" } } } as SubmissionResult, "MISSING")).toThrow();
  });
  it("rejects secret-bearing fields and raw CSV at any level", () => {
    for (const field of ["private_key", "seed", "authorization", "csv_utf8"]) expect(() => publicOnly({ nested: [{ [field]: "never print" }] })).toThrow();
    expect(() => publicOnly({ public_key: "public", request_hash: b64(1), csv_sha256: b64(2) })).not.toThrow();
  });
});
async function checkerFixture() {
  const dir = await folder(), c = config();
  const index: { path: string; kind: string; sha256: string }[] = [];
  for (const [name, kind, value] of [["public-config.json", "configuration", c], ["intent.json", "intent", { config_sha256: sha256(JSON.stringify(c)) }], ["result.json", "step_result", { test_fixture: true }]] as const) {
    const bytes = JSON.stringify(value); await writeFile(path.join(dir, name), bytes); index.push({ path: name, kind, sha256: sha256(bytes) });
  }
  const manifest = { schema_version: 1, kind: "agenttrust_testnet_step", evidence_kind: "recorded_capture", captured_at: "2026-11-12T00:00:00.000Z", git_commit: "0".repeat(40), working_tree_dirty: true, command: "synthetic unit fixture --user-run", step: "validate-b", status: "prepared", exit_status: 0, toolchain: { measured: {}, configured_pins: {}, lock_sha256: "a".repeat(64) }, config_sha256: sha256(JSON.stringify(c)), environment: { network: c.network, core_account: c.core_account, rpc_url: c.rpc_url, expected_wasm_sha256: c.expected_wasm_sha256 }, artifacts: index, native_runtime_gate: "user_run_required", remaining_gates: ["actual execution"] };
  const file = path.join(dir, "manifest.json"); await writeFile(file, JSON.stringify(manifest)); return { dir, file, manifest };
}
describe("read-only evidence checker", () => {
  it("labels dated preparation as recorded evidence and leaves the runtime gate required", async () => {
    const { file } = await checkerFixture();
    expect(await checkTestnetEvidence(file)).toMatchObject({ evidence_kind: "recorded_capture", reported_status: "prepared", captured_at: "2026-11-12T00:00:00.000Z", native_runtime_gate: "user_run_required" });
  });
  it.each(["tamper", "escape", "symlink", "fake-pass", "fake-gate"])("rejects %s evidence", async (kind) => {
    const { dir, file, manifest } = await checkerFixture();
    if (kind === "tamper") await writeFile(path.join(dir, "result.json"), "{}");
    if (kind === "escape") manifest.artifacts[0]!.path = "../outside.json";
    if (kind === "symlink") { const original = await readFile(path.join(dir, "result.json")); await rm(path.join(dir, "result.json")); await writeFile(path.join(dir, "external.json"), original); await symlink(path.join(dir, "external.json"), path.join(dir, "result.json")); }
    if (kind === "fake-pass") manifest.status = "passed";
    if (kind === "fake-gate") manifest.native_runtime_gate = "passed";
    await writeFile(file, JSON.stringify(manifest)); await expect(checkTestnetEvidence(file)).rejects.toThrow();
  });
});
