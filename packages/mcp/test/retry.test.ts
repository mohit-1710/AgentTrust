import { mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AgentTrustClient } from "../../near-sdk/src/client.js";
import type { ExecutePaymentArgs, PaymentView, SubmissionResult } from "../../near-sdk/src/views.js";
import { createAuditHandler } from "../../../examples/invoice-audit/src/server.js";
import { block, context, csv, now, origin, payment, service, signBytes, transaction } from "../../../examples/invoice-audit/test/paid-fixtures.js";
import { createMcpServer } from "../src/server.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("MCP retries retain the real SDK journal across a lost response and never submit twice", async () => {
  // Real MCP, payService, journal and audit handler; chain methods are explicit doubles.
  vi.spyOn(Date, "now").mockReturnValue(Number(now / 1_000_000n));
  const root = await mkdtemp(join(tmpdir(), "agenttrust-mcp-retry-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const attemptsDirectory = join(await realpath(root), "attempts");
  const sdk = new AgentTrustClient({ network: "near:testnet", coreAccount: "core.testnet", rpcUrl: "https://rpc.example", catalog: [{ service_id: service.service_id, service_version: 1, origin }], purchase: { ownerId: context.owner_id, sessionId: context.session_id, attemptsDirectory, waitTimeoutMs: 0 } });
  let record: PaymentView | null = null, submitted: ExecutePaymentArgs | null = null;
  const submission = (): SubmissionResult => submitted && record ? { kind: "final", transaction, receipt_ids: ["mock-receipt"], admission: { kind: "payment", payment: payment(submitted.quote, "pending"), duplicate: false } } : { kind: "uncertain", transaction, reason: "not_final" };
  const reader = { network: "near:testnet" as const, coreAccount: "core.testnet", getPaymentSnapshot: async () => ({ value: record, block }), resolveSubmission: async () => submission() };
  const handler = createAuditHandler({ network: "near:testnet", core_account: "core.testnet", offer: { service, origin, amount_yocto: "10" }, sign: signBytes, nowNs: () => now, reader });
  const provider = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(new Request(String(url), init)));
  vi.stubGlobal("fetch", provider);
  vi.spyOn(sdk, "getService").mockResolvedValue(service);
  vi.spyOn(sdk, "getPolicy").mockResolvedValue({ owner_id: context.owner_id, revision: 1, paused: false, daily_cap_yocto: "100", max_dispatches_per_minute: 10, trusted_services: [], blocked_services: [], blocked_payouts: [] });
  vi.spyOn(sdk, "getSession").mockResolvedValue({ owner_id: context.owner_id, session_id: context.session_id, public_key: "ed25519:test", profile_id: "audit", profile_revision: 1, purchase_cap_yocto: "100", expires_at_ns: (now + 600_000_000_000n).toString(), revoked: false });
  vi.spyOn(sdk, "getPaymentSnapshot").mockImplementation(reader.getPaymentSnapshot);
  vi.spyOn(sdk, "previewPayment").mockResolvedValue({ authorization: "not_proven_by_view", decision: { kind: "allow" } });
  const execute = vi.spyOn(sdk, "executePayment").mockImplementation(async (args, hooks) => {
    await hooks?.beforeBroadcast?.(transaction); submitted = structuredClone(args);
    throw new Error("Simulated lost response after checkpoint; no real transaction");
  });
  vi.spyOn(sdk, "resolveSubmission").mockImplementation(reader.resolveSubmission);
  vi.spyOn(sdk, "awaitPayment").mockImplementation(async () => record ? { kind: "settled", payment: record, block } : { kind: "uncertain", owner_id: context.owner_id, payment_id: context.payment_id, reason: "not_found", block });
  const server = createMcpServer({ client: sdk, ownerId: context.owner_id, sessionId: context.session_id, paymentsEnabled: true });
  const client = new Client({ name: "mcp-journal-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  cleanups.push(() => server.close(), () => client.close());
  const args = { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id };
  const call = (input = args) => client.callTool({ name: "pay_service", arguments: input });
  expect((await call()).structuredContent).toMatchObject({ result: { kind: "uncertain", payment_id: context.payment_id, transaction } });
  expect(submitted).not.toBeNull(); record = payment(submitted!.quote);
  expect((await call()).structuredContent).toMatchObject({ result: { kind: "paid", payment: { state: "settled" }, output_check: { ok: true } } });
  expect((await call()).structuredContent).toMatchObject({ result: { kind: "paid" } });
  expect((await call({ ...args, csvUtf8: csv + "v2,i2,1,USD\n" })).structuredContent).toMatchObject({ result: { kind: "uncertain", payment_id: context.payment_id, reason: "tool_call_failed" } });
  expect(execute).toHaveBeenCalledTimes(1);
  const bodies = provider.mock.calls.map(([, init]) => JSON.parse(init!.body as string) as { mode: string });
  expect(bodies.filter((body) => body.mode === "quote")).toHaveLength(1);
  for (const file of await readdir(attemptsDirectory)) expect(await readFile(join(attemptsDirectory, file), "utf8")).not.toContain(csv);
});
