import "server-only";
import { readDecisions } from "../../../lib/near/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await readDecisions(new URL(request.url).searchParams, {
    AGENTTRUST_NEAR_RPC_URL: process.env.AGENTTRUST_NEAR_RPC_URL,
    AGENTTRUST_NEAR_CORE_ACCOUNT: process.env.AGENTTRUST_NEAR_CORE_ACCOUNT,
    AGENTTRUST_NEAR_OWNER_ID: process.env.AGENTTRUST_NEAR_OWNER_ID,
    AGENTTRUST_NEAR_DECISION_REFS: process.env.AGENTTRUST_NEAR_DECISION_REFS,
  });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
