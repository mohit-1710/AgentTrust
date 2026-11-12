// Imported only by the server-only API route; never configure a signer here.
import { AgentTrustClient, bounded } from "../../../packages/near-sdk/src/client.js";
import { invoiceHash, validateAccountId } from "../../../packages/near-sdk/src/codec.js";
import { finalAdmission } from "../../../packages/near-sdk/src/finality.js";
import type { ExecutePaymentArgs, TransactionLocator } from "../../../packages/near-sdk/src/views.js";
import { transactionUrl } from "./format.js";
import { publicDecision, publicPayment } from "./evidence.js";
import type { DecisionsResponse, RejectedCall } from "./types.js";

const PAGE_LIMIT = 20;
const MAX_RETAINED_PAYMENTS = 128;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

function configuration(env: Record<string, string | undefined>) {
  const rpcUrl = env.AGENTTRUST_NEAR_RPC_URL;
  const coreAccount = env.AGENTTRUST_NEAR_CORE_ACCOUNT;
  const ownerId = env.AGENTTRUST_NEAR_OWNER_ID;
  const rawRefs = env.AGENTTRUST_NEAR_DECISION_REFS;
  if (!rpcUrl && !coreAccount && !ownerId && !rawRefs) return null;
  if (!rpcUrl || !coreAccount || !ownerId) throw new Error("INVALID_CONFIGURATION");
  validateAccountId(coreAccount); validateAccountId(ownerId);
  const client = new AgentTrustClient({ network: "near:testnet", coreAccount, rpcUrl });
  const refs: unknown = rawRefs ? JSON.parse(rawRefs) : [];
  if (!Array.isArray(refs) || refs.length > 8) throw new Error("INVALID_CONFIGURATION");
  const seen = new Set<string>();
  const references: TransactionLocator[] = refs.map((ref) => {
    if (!object(ref) || Object.keys(ref).length !== 2 || ref.sender_account_id !== ownerId || typeof ref.tx_hash !== "string") throw new Error("INVALID_CONFIGURATION");
    transactionUrl(ref.tx_hash);
    if (seen.has(ref.tx_hash)) throw new Error("INVALID_CONFIGURATION");
    seen.add(ref.tx_hash);
    return { tx_hash: ref.tx_hash, sender_account_id: ownerId };
  });
  return { client, ownerId, coreAccount, references };
}

async function rejectedCall(client: AgentTrustClient, transaction: TransactionLocator): Promise<RejectedCall | null> {
  try {
    const raw: unknown = await bounded(client.provider.sendJsonRpc("EXPERIMENTAL_tx_status", { ...transaction, wait_until: "FINAL" }));
    if (!object(raw) || !object(raw.transaction) || !Array.isArray(raw.transaction.actions) || raw.transaction.actions.length !== 1 ||
        !object(raw.transaction.actions[0]) || !object(raw.transaction.actions[0].FunctionCall)) return null;
    const call = raw.transaction.actions[0].FunctionCall;
    if (typeof call.args !== "string" || call.args.length > 90_000) return null;
    const bytes = Buffer.from(call.args, "base64");
    if (bytes.length > 64 * 1024 || bytes.toString("base64") !== call.args) return null;
    const args = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)) as ExecutePaymentArgs;
    // This establishes the submitted call, not a purchase's overall unpaid state.
    // The shared SDK requires FINAL and a matching successful core receipt.
    const result = finalAdmission(raw, transaction, client.coreAccount, args);
    if (!result || result.admission.kind !== "rejected" || args.quote.invoice.network !== client.network ||
        args.quote.invoice.schema_version !== 1 || args.quote.invoice.asset !== "NEAR" ||
        args.quote.invoice.owner_id !== transaction.sender_account_id) return null;
    return { origin: "executed_rejection", invoice: args.quote.invoice, invoice_hash: invoiceHash(args.quote.invoice),
      credential: args.credential === null ? null : { issuer_id: args.credential.issuer_id, credential_id: args.credential.credential_id, revision: args.credential.revision }, decision: publicDecision(result.admission.decision),
      transaction, receipt_ids: result.receipt_ids };
  } catch { return null; }
}

/** Only cursor is caller-controlled. Targets and optional receipt references are operator configuration. */
export async function readDecisions(search: URLSearchParams, env: Record<string, string | undefined>): Promise<{ status: number; body: DecisionsResponse }> {
  const cursor = search.get("cursor");
  if ([...search.keys()].some((key) => key !== "cursor") || search.getAll("cursor").length > 1 ||
      cursor !== null && (!/^(0|[1-9][0-9]*)$/.test(cursor) || cursor.length > 3 || Number(cursor) > MAX_RETAINED_PAYMENTS)) {
    return { status: 400, body: { kind: "error", code: "INVALID_QUERY" } };
  }
  let config: ReturnType<typeof configuration>;
  try { config = configuration(env); }
  catch { return { status: 503, body: { kind: "error", code: "INVALID_CONFIGURATION" } }; }
  if (!config) return { status: 200, body: { kind: "unconfigured" } };
  const { client, ownerId, coreAccount, references } = config;
  try {
    const page = await client.listRecentPayments(ownerId, cursor, PAGE_LIMIT);
    if (page.next_cursor !== null && (BigInt(page.next_cursor) > BigInt(MAX_RETAINED_PAYMENTS) ||
        cursor !== null && BigInt(page.next_cursor) >= BigInt(cursor))) throw new Error("INVALID_PAGE");
    const observations = cursor === null ? await Promise.all(references.map((ref) => rejectedCall(client, ref))) : [];
    const rejections = observations.filter((item): item is RejectedCall => item !== null);
    return { status: 200, body: {
      kind: "ready", origin: "final_contract_view", network: "near:testnet", core_account: coreAccount,
      owner_id: ownerId, observed_at: new Date().toISOString(), page: { ...page, items: page.items.map(publicPayment) }, rejections,
      unresolved_references: observations.length - rejections.length,
    } };
  } catch (error) {
    return { status: 503, body: { kind: "error", code: error instanceof Error && error.message === "DOMAIN_MISMATCH" ? "DOMAIN_MISMATCH" : "RPC_UNAVAILABLE" } };
  }
}
