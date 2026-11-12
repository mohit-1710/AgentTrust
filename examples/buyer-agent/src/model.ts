import type { BuyerConfig } from "./config.js";
import type { ChatMessage, Driver, ModelTrace, ProposedCall, ToolDefinition } from "./loop.js";
import { digest } from "./journal.js";
import { readJson } from "../../../packages/near-sdk/src/paid-protocol.js";
const endpoint = "https://cloud-api.near.ai/v1/chat/completions";
export const modelCatalog = "https://cloud-api.near.ai/v1/model/list";
export const localModelEndpoint = "http://127.0.0.1:11434/v1/chat/completions";
const localModelInfo = "http://127.0.0.1:11434/api/show";
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export async function checkModel(model: string): Promise<void> {
  const r = await fetch(modelCatalog, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!r.ok || r.redirected) throw new Error("MODEL_CATALOG_UNAVAILABLE");
  const body = await readJson(r.body, 1024 * 1024);
  if (!object(body) || !Array.isArray(body.models) || !body.models.some((m) => object(m) && m.modelId === model && object(m.metadata) && m.metadata.isReady === true && Array.isArray(m.metadata.supportedFeatures) && m.metadata.supportedFeatures.includes("tools"))) throw new Error("MODEL_NOT_READY_FOR_TOOLS");
}
/** Ollama's show endpoint reads installed model metadata; it does not pull a model. */
export async function checkLocalModel(model: string): Promise<void> {
  const r = await fetch(localModelInfo, { method: "POST", redirect: "error", headers: { "content-type": "application/json" }, body: JSON.stringify({ model }), signal: AbortSignal.timeout(30_000) });
  if (!r.ok || r.redirected) throw new Error("LOCAL_MODEL_UNAVAILABLE");
  const body = await readJson(r.body, 2 * 1024 * 1024);
  if (!object(body) || !Array.isArray(body.capabilities) || !body.capabilities.includes("tools")) throw new Error("LOCAL_MODEL_NOT_READY_FOR_TOOLS");
}
async function requestModel(endpoint: string, body: Record<string, unknown>, headers: Record<string, string>, timeout: number): Promise<{ call?: ProposedCall; trace: ModelTrace }> {
  const response = await fetch(endpoint, { method: "POST", redirect: "error", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  if (!response.ok || response.redirected) throw new Error("MODEL_REQUEST_FAILED");
  const value = await readJson(response.body, 512 * 1024);
  if (!object(value) || !Array.isArray(value.choices) || value.choices.length !== 1 || !object(value.choices[0]) || !object(value.choices[0].message)) throw new Error("MALFORMED_MODEL_RESPONSE");
  const message = value.choices[0].message, trace: ModelTrace = { request_sha256: digest(body), response_sha256: digest(value), ...(typeof value.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value.id) ? { response_id: value.id } : {}) };
  if (message.tool_calls === undefined) return { trace };
  if (!Array.isArray(message.tool_calls) || message.tool_calls.length !== 1 || !object(message.tool_calls[0])) throw new Error("ONE_TOOL_CALL_REQUIRED");
  const call = message.tool_calls[0];
  if (call.type !== "function" || typeof call.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(call.id) || !object(call.function) || typeof call.function.name !== "string" || typeof call.function.arguments !== "string") throw new Error("MALFORMED_MODEL_TOOL_CALL");
  const args: unknown = JSON.parse(call.function.arguments); if (!object(args)) throw new Error("MALFORMED_MODEL_TOOL_CALL");
  return { trace, call: { name: call.function.name, arguments: args, id: call.id } };
}
export function nearAiDriver(config: BuyerConfig, apiKey: string): Driver {
  if (config.mode !== "near-ai" || !config.model || !apiKey || /[\r\n]/.test(apiKey)) throw new Error("MODEL_CONFIGURATION_REQUIRED");
  return { async next(history: readonly ChatMessage[], tools: readonly ToolDefinition[]) {
    // Qwen 3.6 reasons by default; leave the bounded completion for tool calls.
    const body = { model: config.model, messages: history, tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })), tool_choice: "auto", parallel_tool_calls: false, max_tokens: config.max_completion_tokens, stream: false, ...(config.model === "Qwen/Qwen3.6-35B-A3B-FP8" ? { chat_template_kwargs: { enable_thinking: false } } : {}) };
    return requestModel(endpoint, body, { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, 30_000);
  } };
}
export function localModelDriver(config: BuyerConfig): Driver {
  if (config.mode !== "local-model" || !config.model) throw new Error("MODEL_CONFIGURATION_REQUIRED");
  return { async next(history: readonly ChatMessage[], tools: readonly ToolDefinition[]) {
    const body = { model: config.model, messages: history, tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })), tool_choice: "auto", max_tokens: config.max_completion_tokens, stream: false };
    return requestModel(localModelEndpoint, body, { "content-type": "application/json" }, 120_000);
  } };
}
/** Deterministic, labeled scenario harness. This is not an autonomous model. */
export function scriptedDriver(config: BuyerConfig): Driver {
  let step = 0;
  return { async next(history) {
    if (step++ === 0) return { call: { name: "list_services", arguments: {} } };
    if (step === 2) return { call: { name: "get_policy", arguments: {} } };
    const initial = JSON.parse(history[1]!.content!) as { active_candidate: typeof config.candidates[number] | null; completed_payment_ids: string[] };
    const finished = new Set(initial.completed_payment_ids);
    for (const message of history) if (message.role === "tool") { const result = JSON.parse(message.content!); if (result.kind === "denied") finished.add(result.payment_id); if (result.kind === "failed") finished.add(result.payment.invoice.payment_id); }
    const candidate = initial.active_candidate && !finished.has(initial.active_candidate.payment_id) ? initial.active_candidate : config.candidates.find((c) => !finished.has(c.payment_id));
    if (!candidate) return {};
    return { call: { name: "pay_service", arguments: { serviceId: candidate.service_id, paymentId: candidate.payment_id, csvUtf8: config.csv_utf8 } } };
  } };
}
