import { isAddress, getAddress } from "viem";
import { publicClient } from "./viemClient";
import { REPUTATION_REGISTRY, reputationAbi } from "./contracts";

export interface ReputationResult {
  agentId: bigint;
  clients: `0x${string}`[];
  count: number;
  /** SUM of feedback values across trusted attestors (per ERC-8004 getSummary). */
  total: number;
  decimals: number;
  /** total / count, or null if count == 0. */
  average: number | null;
}

export type TrustVerdict = "TRUSTED" | "THIN_HISTORY" | "UNTRUSTED" | "NO_DATA";

export function parseClients(raw: string): `0x${string}`[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!isAddress(s)) throw new Error(`Invalid address: ${s}`);
      return getAddress(s);
    });
}

/**
 * Live read against the ERC-8004 Reputation Registry on Monad testnet.
 * getSummary REQUIRES a non-empty clients array (reverts otherwise) — the
 * payer chooses whose ratings it trusts (Sybil resistance).
 */
export async function readReputation(
  agentId: bigint,
  clients: `0x${string}`[]
): Promise<ReputationResult> {
  if (clients.length === 0) {
    throw new Error(
      "At least one trusted attestor address is required (the registry reverts on an empty client set)."
    );
  }
  const [count, summaryValue, decimals] = await publicClient.readContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: "getSummary",
    args: [agentId, clients, "", ""],
  });

  const cnt = Number(count);
  const total = Number(summaryValue);
  return {
    agentId,
    clients,
    count: cnt,
    total,
    decimals: Number(decimals),
    average: cnt > 0 ? total / cnt : null,
  };
}

/**
 * Consumer-friendly verdict. Tunable thresholds; mirrors a sensible default
 * payer policy (minReputation ~70 on a 0..100 scale, minFeedbackCount 1).
 */
export function trustVerdict(
  r: ReputationResult,
  opts: { minAverage?: number; minCount?: number } = {}
): { verdict: TrustVerdict; label: string; tone: "good" | "bad" | "warn" } {
  const minAverage = opts.minAverage ?? 70;
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
