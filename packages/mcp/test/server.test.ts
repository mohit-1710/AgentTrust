import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AgentTrustClient } from "../../near-sdk/src/client.js";
import { createMcpServer } from "../src/server.js";
import { parseMcpConfig } from "../src/config.js";
import { block, context, csv, hash, payment, quote, service, transaction } from "../../../examples/invoice-audit/test/paid-fixtures.js";

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map((close) => close())); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const publicConfig = { schema_version: 1, network: "near:testnet", core_account: "core.testnet", rpc_url: "https://rpc.example", owner_id: context.owner_id, session_id: context.session_id, attempts_directory: "/tmp/agenttrust-test-only", catalog: [{ service_id: service.service_id, service_version: 1, origin: "https://audit.example" }] };
async function connect(paymentsEnabled = true) {
  const sdk = new AgentTrustClient({ network: "near:testnet", coreAccount: "core.testnet", rpcUrl: "https://rpc.example" });
  const reads = {
    list: vi.spyOn(sdk, "listServices").mockResolvedValue({ items: [{ ...service, registered: true, configured: true, eligibility: "not_evaluated" }], next_cursor: null }),
    service: vi.spyOn(sdk, "getService").mockResolvedValue(service),
    policy: vi.spyOn(sdk, "getPolicy").mockResolvedValue(null),
    preview: vi.spyOn(sdk, "previewPayment").mockResolvedValue({ authorization: "not_proven_by_view", decision: { kind: "require_validation", code: "MISSING", requirement: { capability_namespace: "invoice.audit", capability_version: 1, conformance_suite_version: 1, conformance_suite_hash: hash(9), accepted_issuers: ["issuer.testnet"] } } }),
    payment: vi.spyOn(sdk, "getPaymentSnapshot").mockResolvedValue({ value: null, block }),
    pay: vi.spyOn(sdk, "payService").mockResolvedValue({ kind: "uncertain", payment_id: context.payment_id, reason: "not_found", transaction }),
  };
  const server = createMcpServer({ client: sdk, ownerId: context.owner_id, sessionId: context.session_id, paymentsEnabled });
  const client = new Client({ name: "agenttrust-tests", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  closers.push(() => client.close(), () => server.close());
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });
  return { sdk, reads, client, call };
}
function result(value: Awaited<ReturnType<Client["callTool"]>>): unknown { return value.structuredContent && typeof value.structuredContent === "object" && "result" in value.structuredContent ? value.structuredContent.result : undefined; }

describe("local six-tool MCP boundary", () => {
  it("initializes with exactly six tools and marks only pay_service money-moving", async () => {
    const s = await connect(); const { tools } = await s.client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(["get_payment", "get_policy", "get_service", "list_services", "pay_service", "preview_payment"]);
    for (const tool of tools) { expect(tool.inputSchema.additionalProperties).toBe(false); expect(tool.annotations?.readOnlyHint).toBe(tool.name !== "pay_service"); }
    expect(tools.find((tool) => tool.name === "pay_service")?.inputSchema.required).toEqual(["serviceId", "csvUtf8", "paymentId"]);
    expect(s.client.getInstructions()).toContain("uncertain");
  });
  it("maps bounded read tools to fixed-owner SDK views without requiring a worker key", async () => {
    const s = await connect(false);
    expect(result(await s.call("list_services", { cursor: "5", limit: 2 }))).toEqual(await s.reads.list.mock.results[0]!.value);
    expect(s.reads.list).toHaveBeenCalledWith("5", 2);
    expect(result(await s.call("get_service", { serviceId: service.service_id }))).toEqual(service);
    expect(result(await s.call("get_policy"))).toBe(null); expect(s.reads.policy).toHaveBeenCalledWith(context.owner_id);
    expect(result(await s.call("get_payment", { paymentId: context.payment_id }))).toEqual({ kind: "uncertain", owner_id: context.owner_id, payment_id: context.payment_id, reason: "not_found", block });
    expect(s.reads.payment).toHaveBeenCalledWith(context.owner_id, context.payment_id);
  });
  it.each([{ limit: 21 }, { cursor: "01" }, { cursor: "18446744073709551616" }, { cursor: "/tmp/file" }, { rpcUrl: "https://evil.example" }])("rejects list bounds/target overrides %j", async (args) => {
    const s = await connect(); expect((await s.call("list_services", args)).isError).toBe(true); expect(s.reads.list).not.toHaveBeenCalled();
  });
  it("preserves preview requirement and explicit lack of signer proof", async () => {
    const s = await connect(); const args = { quote: quote(), credential: null };
    const value = await s.call("preview_payment", args); expect(value.isError).not.toBe(true);
    expect(result(value)).toEqual(await s.reads.preview.mock.results[0]!.value); expect(s.reads.preview).toHaveBeenCalledWith(args);
  });
  it.each([{ owner_id: "foreign.testnet" }, { session_id: hash(5) }, { core_account: "foreign.testnet" }])("blocks foreign preview context %j", async (change) => {
    const s = await connect(); expect((await s.call("preview_payment", { quote: quote(change), credential: null })).isError).toBe(true); expect(s.reads.preview).not.toHaveBeenCalled();
  });
  it("rejects arbitrary paths, raw actions, endpoint URLs and owner overrides before calling pay", async () => {
    const s = await connect(); const base = { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id };
    for (const extra of [{ filePath: "/etc/passwd" }, { transaction: {} }, { url: "https://evil.example" }, { ownerId: "foreign.testnet" }]) expect((await s.call("pay_service", { ...base, ...extra })).isError).toBe(true);
    expect((await s.call("pay_service", { serviceId: service.service_id, csvUtf8: csv })).isError).toBe(true);
    expect((await s.call("pay_service", { ...base, csvUtf8: "x".repeat(65537) })).isError).toBe(true);
    expect(s.reads.pay).not.toHaveBeenCalled();
  });
  it("accepts a valid UTF-8 BOM and rejects unpaired surrogates before payment", async () => {
    const s = await connect(); const args = { serviceId: service.service_id, paymentId: context.payment_id };
    expect((await s.call("pay_service", { ...args, csvUtf8: "\uFEFF" + csv })).isError).not.toBe(true);
    expect(s.reads.pay).toHaveBeenCalledWith({ ...args, csvUtf8: "\uFEFF" + csv });
    s.reads.pay.mockClear();
    expect((await s.call("pay_service", { ...args, csvUtf8: "\uD800" })).isError).toBe(true);
    expect(s.reads.pay).not.toHaveBeenCalled();
  });
  it("sanitizes returned retrieval errors while preserving settled payment context", async () => {
    const s = await connect(); s.reads.pay.mockResolvedValue({ kind: "retrieval_failed", payment: payment(), block, transaction, reason: "secret response body" });
    const value = await s.call("pay_service", { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id });
    expect(result(value)).toMatchObject({ kind: "retrieval_failed", reason: "report_retrieval_or_validation_failed", payment: { state: "settled" }, transaction });
    expect(JSON.stringify(value)).not.toContain("secret response");
  });
  it("passes the caller ID unchanged on repeated calls and preserves uncertainty", async () => {
    const s = await connect(); const args = { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id };
    const first = await s.call("pay_service", args), second = await s.call("pay_service", args);
    expect(result(first)).toEqual(result(second)); expect(result(first)).toMatchObject({ kind: "uncertain", payment_id: args.paymentId, transaction });
    expect(s.reads.pay.mock.calls).toEqual([[args], [args]]);
  });
  it.each(["preview", "executed_rejection", "recorded_replay"] as const)("preserves %s denial without adding receipts", async (origin) => {
    const s = await connect(); const value = { kind: "denied" as const, origin, payment_id: context.payment_id, decision: { kind: "deny" as const, code: "UNKNOWN_SERVICE" as const }, ...(origin === "executed_rejection" ? { transaction, receipt_ids: ["receipt"] } : {}), ...(origin === "recorded_replay" ? { original_origin: "preview" as const } : {}) };
    s.reads.pay.mockResolvedValue(value);
    expect(result(await s.call("pay_service", { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id }))).toEqual(value);
  });
  it("does not turn a generic payment exception into unpaid and does not expose raw errors", async () => {
    const s = await connect(); s.reads.pay.mockRejectedValue(new Error("secret-key=super-private; input CSV content"));
    const value = await s.call("pay_service", { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id });
    expect(value.isError).toBe(true); expect(result(value)).toEqual({ kind: "uncertain", payment_id: context.payment_id, reason: "tool_call_failed" });
    expect(JSON.stringify(value)).not.toContain("super-private"); expect(JSON.stringify(value)).not.toContain(csv);
  });
  it("keeps read errors distinct from an empty policy/history", async () => {
    const s = await connect(false); s.reads.policy.mockRejectedValue(new Error("secret provider URL"));
    const value = await s.call("get_policy"); expect(value.isError).toBe(true); expect(result(value)).toEqual({ kind: "tool_error", code: "READ_FAILED" }); expect(JSON.stringify(value)).not.toContain("secret");
  });
  it("does not invoke payment SDK in read-only mode", async () => {
    const s = await connect(false); const value = await s.call("pay_service", { serviceId: service.service_id, csvUtf8: csv, paymentId: context.payment_id });
    expect(value.isError).toBe(true); expect(result(value)).toMatchObject({ kind: "tool_error", code: "PAYMENT_NOT_CONFIGURED" }); expect(s.reads.pay).not.toHaveBeenCalled();
  });
  it("rejects owner management and arbitrary signing tools", async () => {
    const s = await connect(); for (const name of ["set_policy", "withdraw_available", "sign", "execute_payment"]) expect((await s.call(name)).isError).toBe(true);
    expect(s.reads.pay).not.toHaveBeenCalled();
  });
  it("keeps settled and pending observations separate", async () => {
    const s = await connect(false); s.reads.payment.mockResolvedValue({ value: payment(), block });
    expect(result(await s.call("get_payment", { paymentId: context.payment_id }))).toMatchObject({ kind: "settled", payment: { state: "settled" } });
    s.reads.payment.mockResolvedValue({ value: payment(quote(), "pending"), block });
    expect(result(await s.call("get_payment", { paymentId: context.payment_id }))).toMatchObject({ kind: "uncertain", reason: "pending", payment: { state: "pending" } });
  });
});

describe("public MCP configuration", () => {
  it("accepts explicit public targets without a secret key", () => expect(parseMcpConfig(publicConfig)).toEqual(publicConfig));
  it.each([{ private_key: "secret" }, { owner_key: "secret" }, { endpoint: "https://evil.example" }, { network: "near:mainnet" }, { attempts_directory: "relative" }, { catalog: [{ service_id: service.service_id, service_version: 1, origin: "http://audit.example" }] }])("rejects unsafe or extra configuration %j", (change) => expect(() => parseMcpConfig({ ...publicConfig, ...change })).toThrow("INVALID_MCP_CONFIG"));
});
