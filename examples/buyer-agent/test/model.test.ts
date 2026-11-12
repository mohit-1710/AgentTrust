import { afterEach, expect, it, vi } from "vitest";
import { nearAiDriver, checkModel } from "../src/model.js";
import { parseBuyerConfig } from "../src/config.js";
import { workerEnvironment, runCli } from "../src/run.js";
import { csv, hash } from "../../invoice-audit/test/paid-fixtures.js";
const config = () => parseBuyerConfig({ schema_version: 1, job_id: hash(1), mcp_config_file: "/tmp/mcp.json", job_directory: "/tmp/jobs", csv_utf8: csv, candidates: [{ service_id: "a.testnet", payment_id: hash(2) }], mode: "near-ai", model: "explicit/model", max_steps: 3, max_completion_tokens: 256 });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("uses one fixed Cloud endpoint, explicit model/token bound and auth only in the request header", async () => {
  const fetcher = vi.fn(async () => Response.json({ id: "response_1", choices: [{ message: { tool_calls: [{ id: "call_1", type: "function", function: { name: "get_policy", arguments: "{}" } }] } }] })); vi.stubGlobal("fetch", fetcher);
  const driver = nearAiDriver(config(), "test-api-key-never-log"); const next = await driver.next([{ role: "user", content: csv }], [{ name: "get_policy", inputSchema: { type: "object" } }]);
  expect(next.call).toEqual({ name: "get_policy", arguments: {}, id: "call_1" }); expect(JSON.stringify(next)).not.toContain(csv); expect(JSON.stringify(next)).not.toContain("test-api-key");
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]; expect(url).toBe("https://cloud-api.near.ai/v1/chat/completions"); expect(init.redirect).toBe("error");
  const body = JSON.parse(init.body as string); expect(body.model).toBe("explicit/model"); expect(body.max_tokens).toBe(256); expect(body.parallel_tool_calls).toBe(false); expect(body).not.toHaveProperty("chat_template_kwargs"); expect(init.body).not.toContain("test-api-key");
});
it.each([{ calls: [] }, { calls: [{}, {}] }, { calls: [{ id: "bad", type: "function", function: { name: "pay_service", arguments: "null" } }] }])("rejects multiple/malformed tool requests before any execution %#", async ({ calls }) => {
  vi.stubGlobal("fetch", async () => Response.json({ choices: [{ message: { tool_calls: calls } }] })); await expect(nearAiDriver(config(), "test").next([], [])).rejects.toThrow();
});
it("plain completion returns no tool and cannot mark a task paid", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ choices: [{ message: { content: "Payment complete!" } }] })); expect((await nearAiDriver(config(), "test").next([], [])).call).toBeUndefined();
});
it("requires a ready explicit model with tools in the current public catalogue", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ models: [{ modelId: "explicit/model", metadata: { supportedFeatures: ["tools"], isReady: true } }] })); await expect(checkModel("explicit/model")).resolves.toBeUndefined(); await expect(checkModel("invented/model")).rejects.toThrow();
  vi.stubGlobal("fetch", async () => Response.json({ models: [{ modelId: "explicit/model", metadata: { supportedFeatures: ["tools"], isReady: false } }] })); await expect(checkModel("explicit/model")).rejects.toThrow();
});
it("requires a positive readiness flag before choosing a tool model", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ models: [{ modelId: "explicit/model", metadata: { supportedFeatures: ["tools"] } }] }));
  await expect(checkModel("explicit/model")).rejects.toThrow("MODEL_NOT_READY_FOR_TOOLS");
});
it("disables Qwen 3.6 default reasoning within the fixed tool-call token budget", async () => {
  const fetcher = vi.fn(async () => Response.json({ choices: [{ message: { tool_calls: [{ id: "call_1", type: "function", function: { name: "get_policy", arguments: "{}" } }] } }] }));
  vi.stubGlobal("fetch", fetcher);
  await nearAiDriver({ ...config(), model: "Qwen/Qwen3.6-35B-A3B-FP8" }, "test").next([{ role: "user", content: csv }], [{ name: "get_policy", inputSchema: { type: "object" } }]);
  const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(init.body as string).chat_template_kwargs).toEqual({ enable_thinking: false });
});
it("does not echo provider errors or authorization data", async () => {
  vi.stubGlobal("fetch", async () => new Response("secret body and input CSV", { status: 401 })); await expect(nearAiDriver(config(), "secret").next([], [])).rejects.toThrow("MODEL_REQUEST_FAILED");
});
it("scrubs all other credentials from worker environment and preserves explicit local CA", () => {
  expect(workerEnvironment({ PATH: "/bin", AGENTTRUST_WORKER_PRIVATE_KEY: "worker-test", NODE_EXTRA_CA_CERTS: "/public/ca.pem", NEAR_AI_API_KEY: "llm-secret", OWNER_KEY: "owner", ISSUER_SEED: "issuer", PROVIDER_KEY: "provider", NODE_TLS_REJECT_UNAUTHORIZED: "0" })).toEqual({ PATH: "/bin", AGENTTRUST_WORKER_PRIVATE_KEY: "worker-test", NODE_EXTRA_CA_CERTS: "/public/ca.pem" });
});
it("requires the explicit execute flag and does not access network for help", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await runCli(["--help"]); expect(log).toHaveBeenCalledWith(expect.stringContaining("billable")); await expect(runCli(["--config", "/no/file.json"])).rejects.toThrow("EXPLICIT_EXECUTION_REQUIRED"); expect(fetcher).not.toHaveBeenCalled();
});
it.each([{ candidates: [{ service_id: "a.testnet", payment_id: hash(2) }, { service_id: "b.testnet", payment_id: hash(2) }] }, { model: undefined }, { job_directory: "relative" }, { api_key: "secret" }, { max_steps: 13 }])("rejects unsafe caller configuration %#", (change) => { expect(() => parseBuyerConfig({ ...config(), ...change })).toThrow(); });
