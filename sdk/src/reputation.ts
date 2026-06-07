import type { Address } from "viem";
import { getAddress } from "viem";
import type { AgentTrustClients } from "./chain.js";
import { ADDRESSES } from "./addresses.js";
import { reputationAbi } from "./abis.js";

export interface ReputationResult {
  agentId: bigint;
  /** Trusted feedback authors this read aggregated over. */
  clients: Address[];
  /** Number of feedback entries from the trusted set. */
  count: number;
  /**
   * The deployed ERC-8004 Reputation Registry returns `summaryValue` as the
   * AVERAGE feedback value already (verified on-chain). `null` when count == 0.
   */
  average: number | null;
  /** Reconstructed sum (average x count) for convenience. */
  total: number;
  /** Decimal scale of the feedback value (v1 registry uses 0). */
  decimals: number;
}

export type TrustVerdict =
  | "TRUSTED"
  | "THIN_HISTORY"
  | "UNTRUSTED"
  | "NO_DATA";

export interface VerdictResult {
  verdict: TrustVerdict;
  label: string;
  tone: "good" | "bad" | "warn";
}

/**
 * Read a payee agent's reputation from the ERC-8004 Reputation Registry.
 *
 * The registry is Sybil-resistant by design: it REQUIRES a non-empty `clients`
 * array (the set of feedback authors the payer trusts) and reverts otherwise.
 *
 * @param agentId  ERC-8004 agent id (Identity NFT tokenId).
 * @param clients  trusted feedback-author addresses (at least one).
 */
export async function getReputation(
  agentId: bigint,
  clients: Address[],
  ctx: AgentTrustClients,
): Promise<ReputationResult> {
  if (clients.length === 0) {
    throw new Error(
      "getReputation requires at least one trusted attestor address — the ERC-8004 registry reverts on an empty client set.",
    );
  }

  const normalized = clients.map((c) => getAddress(c));

  const [count, summaryValue, decimals] = await ctx.public.readContract({
    address: ADDRESSES.reputation,
    abi: reputationAbi,
    functionName: "getSummary",
    args: [agentId, normalized, "", ""],
  });

  const cnt = Number(count);
  const avg = Number(summaryValue); // registry returns the average directly

  return {
    agentId,
    clients: normalized,
    count: cnt,
    average: cnt > 0 ? avg : null,
    total: cnt > 0 ? avg * cnt : 0,
    decimals: Number(decimals),
  };
}

/**
 * Turn a raw reputation read into a consumer-friendly verdict. Thresholds
 * mirror a sensible default payer policy (average >= 50, at least 1 rating).
 */
export function trustVerdict(
  r: ReputationResult,
  opts: { minAverage?: number; minCount?: number } = {},
): VerdictResult {
  const minAverage = opts.minAverage ?? 50;
  const minCount = opts.minCount ?? 1;

  if (r.count === 0) {
    return {
      verdict: "NO_DATA",
      label: "No ratings from your trusted attestors",
      tone: "warn",
    };
  }
  if (r.count < minCount) {
    return {
      verdict: "THIN_HISTORY",
      label: "Thin history — not enough trusted ratings",
      tone: "warn",
    };
  }
  if ((r.average ?? 0) < minAverage) {
    return {
      verdict: "UNTRUSTED",
      label: "Below trust threshold — likely scammer",
      tone: "bad",
    };
  }
  return {
    verdict: "TRUSTED",
    label: "Trusted by your attestors",
    tone: "good",
  };
}
