/** Worker-only scripted evidence runner; it is not presented as an autonomous LLM run. */
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { KeyPairSigner, type KeyPairString } from "near-api-js";
import { AgentTrustClient } from "../../../packages/near-sdk/src/client.js";
import { AttemptJournal, type AttemptContext } from "../../../packages/near-sdk/src/attempts.js";
import { invoiceHash, requestHash } from "../../../packages/near-sdk/src/codec.js";
import { loadConformanceSuite } from "../../invoice-audit/src/conformance.js";
import { checkAuditOutput } from "../../invoice-audit/src/check-output.js";
import type { PaidAuditResult } from "../../../packages/near-sdk/src/pay-service.js";
import type { Decision, SubmissionResult } from "../../../packages/near-sdk/src/views.js";
import { argumentsFor, catalog, credential, readConfig, requirement, sha256, type DemoConfig } from "./config.js";
import { Capture, ensure, safeError } from "./capture.js";
import { OperationJournal } from "./operations.js";

export const runSteps = ["missing-credential", "purchase", "resume", "retry", "revoked-credential", "identity-quote", "changed-identity", "observe-missing-credential", "observe-revoked-credential", "observe-changed-identity", "observe-retry"] as const;
export const runUsage = "Usage: pnpm demo:run:testnet -- --user-run --config /absolute/demo.json --output artifacts/local/testnet/NEW_STEP --step NAME\nWorker-only scripted runner. It may pay on testnet; no automatic setup or supplier switching.\nresume and observe-* need no key or signer: they only resolve saved transactions/retrieve results.\nSteps: " + runSteps.join(", ");
export function denialMatches(decision: Decision, code: string): boolean { return decision.kind !== "allow" && decision.code === code; }
export function requirePaid(result: PaidAuditResult, expectedHash: string): asserts result is Extract<PaidAuditResult, { kind: "paid" }> {
  ensure(result.kind === "paid" && result.payment.state === "settled" && result.payment.invoice.request_hash === expectedHash && result.output_check.ok === true && result.block.finality === "final", "PAID_RESULT_REQUIRED");
}
export function requireRejected(result: SubmissionResult, code: string): void {
  ensure(result.kind === "final" && result.admission.kind === "rejected" && denialMatches(result.admission.decision, code), "EXPECTED_FINAL_REJECTION_REQUIRED");
}
async function paymentSnapshot(capture: Capture, client: AgentTrustClient, c: DemoConfig, id: string, name: string): Promise<void> {
  await capture.query(client, name, { request_type: "call_function", account_id: c.core_account, method_name: "get_payment", args_base64: Buffer.from(JSON.stringify({ owner_id: c.owner_id, payment_id: id })).toString("base64"), finality: "final" });
}
export async function runDemo(argv: readonly string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") { console.log(runUsage); return; }
  const args = argumentsFor(argv, runSteps); // No configuration/key/network effect before explicit consent flag.
  const c = await readConfig(args.config);
  const observing = args.command.startsWith("observe-");
  const command = observing ? args.command.slice("observe-".length) : args.command;
  ensure(!process.env.AGENTTRUST_SETUP_PRIVATE_KEY && !process.env.AGENTTRUST_INVOICE_SEED_BASE64, "MIXED_ROLE_KEYS_FORBIDDEN");
  let signer: KeyPairSigner | undefined;
  let publicKey: string | undefined;
  if (!observing && command !== "resume") {
    const secret = process.env.AGENTTRUST_WORKER_PRIVATE_KEY;
    ensure(typeof secret === "string" && secret.startsWith("ed25519:"), "WORKER_KEY_REQUIRED");
    signer = KeyPairSigner.fromSecretKey(secret as KeyPairString);
    publicKey = (await signer.getPublicKey()).toString();
    ensure(publicKey === c.worker_public_key, "WORKER_KEY_MISMATCH");
  }
  const capture = await Capture.start(args.output, c, args.command, `pnpm demo:run:testnet -- ${argv.map((a) => JSON.stringify(a)).join(" ")}`);
  try {
    const fixture = loadConformanceSuite().fixtures.find((f) => f.fixture_id === "mixed-validity")!;
    const csvUtf8 = fixture.csv_utf8;
    const hash = requestHash(csvUtf8);
    await capture.put("input-commitment.json", "synthetic_fixture", { fixture_id: fixture.fixture_id, request_hash: hash, csv_sha256: fixture.csv_sha256, golden_sha256: fixture.golden_sha256, csv_in_capture: false });
    const label = command === "missing-credential" ? "a" : "b";
    const id = command === "missing-credential" ? c.payment_ids.missing : command === "revoked-credential" ? c.payment_ids.revoked : command.startsWith("identity") || command === "changed-identity" ? c.payment_ids.identity : c.payment_ids.paid;
    const provider = c.providers[label];
    const client = new AgentTrustClient({ network: c.network, coreAccount: c.core_account, rpcUrl: c.rpc_url, catalog: catalog(c), ...(signer ? { worker: { ownerId: c.owner_id, signer } } : {}), purchase: { ownerId: c.owner_id, sessionId: c.session_id, attemptsDirectory: c.attempts_directory, credentials: command === "identity-quote" ? [] : [{ service_id: c.providers.b.service_id, service_version: 1, credential: credential(c) }], waitTimeoutMs: 60_000 } });
    await capture.checkCore(client);
    if (!observing && !["resume", "retry"].includes(command)) {
      const profile = await client.getProfile(c.owner_id, c.profile_id);
      ensure(profile && isDeepStrictEqual(profile.requirement, requirement(c)), "PINNED_CAPABILITY_PROFILE_REQUIRED");
      if (command === "revoked-credential") ensure((await client.getCredential(c.issuer_id, c.credential_id))?.revoked === true, "REVOKED_CREDENTIAL_REQUIRED_BEFORE_NEGATIVE_CASE");
    }
    const before = await client.getPaymentSnapshot(c.owner_id, id);
    await paymentSnapshot(capture, client, c, id, "payment-before.json");
    const balanceBefore = await capture.query(client, "payout-before.json", { request_type: "view_account", account_id: provider.payout_account, finality: "final" }) as { amount: string };
    const context: AttemptContext = { network: c.network, core_account: c.core_account, owner_id: c.owner_id, service_id: provider.service_id, request_hash: hash, payment_id: id };
    const journal = new AttemptJournal(c.attempts_directory);
    const operation = new OperationJournal(c, `worker:${command}:${id}`, c.owner_id);
    const direct = async (saved: NonNullable<Awaited<ReturnType<AttemptJournal["load"]>>>) => {
      const previous = await operation.existing();
      if (observing) {
        ensure(previous, "SAVED_DIRECT_TRANSACTION_REQUIRED");
        await capture.beforeBroadcast(previous); // Locator capture only; no broadcast.
        return client.resolveSubmission(previous, { quote: saved.quote, credential: saved.credential });
      }
      ensure(previous === null, "SAVED_DIRECT_TRANSACTION_USE_OBSERVE");
      return client.executePayment({ quote: saved.quote, credential: saved.credential }, { beforeBroadcast: async (transaction) => { await operation.claim(transaction); await capture.beforeBroadcast(transaction); } });
    };
    let result: unknown;
    if (command === "purchase" || command === "retry" || command === "resume") {
      if (command === "retry") ensure(before.value?.state === "settled", "ORIGINAL_SETTLED_PAYMENT_REQUIRED");
      else if (command === "resume") {
        const saved = await journal.load(context);
        ensure(saved && (await journal.checkpoint(saved))?.kind === "submission", "SAVED_PURCHASE_SUBMISSION_REQUIRED");
      } else {
        ensure(before.value === null && await journal.load(context) === null, "FRESH_PURCHASE_REQUIRED_USE_RESUME_TO_RECOVER");
      }
      const paid = await client.payService({ serviceId: provider.service_id, csvUtf8, paymentId: id });
      await capture.put("sdk-result.json", "paid_sdk_result", paid);
      if (paid.kind === "uncertain") { await capture.finish("uncertain", paid, publicKey); process.exitCode = 2; return; }
      requirePaid(paid, hash);
      ensure(checkAuditOutput(csvUtf8, paid.report, fixture.golden).ok, "GOLDEN_OUTPUT_MISMATCH");
      const saved = await journal.load(context);
      ensure(saved && saved.invoice_hash === paid.payment.invoice_hash, "ORIGINAL_ATTEMPT_REQUIRED");
      await capture.put("saved-attempt.json", "signed_attempt", saved);
      if (command === "retry") {
        ensure(before.value!.invoice_hash === paid.payment.invoice_hash && before.value!.dispatched_at_ns === paid.payment.dispatched_at_ns, "RETRY_CHANGED_PAYMENT");
        const duplicate = await direct(saved);
        await capture.put("duplicate-result.json", "submission_result", duplicate);
        if (duplicate.kind === "uncertain") { await capture.finish("uncertain", duplicate, publicKey); process.exitCode = 2; return; }
        ensure(duplicate.admission.kind === "payment" && duplicate.admission.duplicate && duplicate.admission.payment.state === "settled" && duplicate.admission.payment.invoice_hash === saved.invoice_hash, "EXACT_CONTRACT_RETRY_REQUIRED");
        await capture.transaction(client, duplicate.transaction);
      } else await capture.transaction(client, paid.transaction);
      result = { ...paid, input_hash: hash, output_sha256: sha256(JSON.stringify(paid.report)), replay_checked: command === "retry" };
    } else {
      ensure(before.value === null, "NEGATIVE_CASE_ALREADY_HAS_PAYMENT");
      if (command !== "changed-identity" && !observing) {
        const preview = await client.payService({ serviceId: provider.service_id, csvUtf8, paymentId: id });
        await capture.put("preview-result.json", "sdk_preview_result", preview);
        const code = command === "revoked-credential" ? "REVOKED" : "MISSING";
        ensure(preview.kind === "denied" && (preview.origin === "preview" || preview.origin === "recorded_replay") && denialMatches(preview.decision, code), "EXPECTED_PREVIEW_REFUSAL_REQUIRED");
        if (command === "identity-quote") {
          const saved = await journal.load(context); ensure(saved, "ORIGINAL_ATTEMPT_REQUIRED");
          await capture.put("saved-attempt.json", "signed_attempt", saved);
          await capture.finish("prepared", { quote_ready: true, payment_id: id, expires_at_ns: saved.quote.invoice.expires_at_ns, next_step: "provider-b-rotate, then changed-identity before quote expiry", payment_sent: false }, publicKey); return;
        }
      }
      const saved = await journal.load(context);
      ensure(saved && saved.invoice_hash === invoiceHash(saved.quote.invoice), "ORIGINAL_ATTEMPT_REQUIRED");
      await capture.put("saved-attempt.json", "signed_attempt", saved);
      const expected = command === "changed-identity" ? "IDENTITY_CHANGED" : command === "revoked-credential" ? "REVOKED" : "MISSING";
      if (!observing) {
        const freshPreview = await client.previewPayment({ quote: saved.quote, credential: saved.credential });
        ensure(denialMatches(freshPreview.decision, expected), "NEGATIVE_QUOTE_EXPIRED_OR_CONTEXT_CHANGED");
      }
      const submission = await direct(saved);
      await capture.put("execution-result.json", "submission_result", submission);
      if (submission.kind === "uncertain") { await capture.finish("uncertain", submission, publicKey); process.exitCode = 2; return; }
      requireRejected(submission, expected);
      await capture.transaction(client, submission.transaction);
      ensure(await client.getPayment(c.owner_id, id) === null, "REJECTION_CREATED_PAYMENT");
      result = { origin: "executed_rejection", expected_code: expected, payment_id: id, submission, payment: null };
    }
    const balanceAfter = await capture.query(client, "payout-after.json", { request_type: "view_account", account_id: provider.payout_account, finality: "final" }) as { amount: string };
    const observedDelta = BigInt(balanceAfter.amount) - BigInt(balanceBefore.amount);
    if (command !== "resume") ensure(observedDelta === (command === "purchase" ? BigInt(provider.amount_yocto) : 0n), "CONTROLLED_PAYOUT_DELTA_MISMATCH");
    await paymentSnapshot(capture, client, c, id, "payment-after.json");
    await capture.finish("passed", { case_result: result, observed_payout_delta_yocto: observedDelta.toString(), asserted: true, observation_only: observing || command === "resume", ...(command === "resume" ? { limitation: "Inspect original purchase capture for payout-before; this resumes the existing submission without resending." } : {}) }, publicKey);
  } catch (error) {
    await capture.finish(capture.unresolvedBroadcast ? "uncertain" : "failed", { code: safeError(error), action: "Stop. Inspect the durable attempt and any transaction-before-send.json; a failed step is not evidence of nonpayment." }, publicKey);
    process.exitCode = capture.unresolvedBroadcast ? 2 : 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runDemo(process.argv.slice(2)).catch((error: unknown) => { console.error(safeError(error)); process.exitCode = 1; });
