import { publicClient } from "./viemClient";
import {
  POLICY_VAULT_ADDRESS,
  policyVaultAbi,
} from "./contracts";
import { readReputation } from "./reputation";

export type Decision = "ALLOW" | "DENY" | "REQUIRE_VALIDATION";

export interface GateResult {
  decision: Decision;
  reason: string;
  /** "onchain" = real PolicyVault.gate(); "preview" = client-side mirror. */
  source: "onchain" | "preview";
}

const DECISIONS: Decision[] = ["ALLOW", "DENY", "REQUIRE_VALIDATION"];

/** A sample default payer policy used for the client-side preview. */
export interface SamplePolicy {
  perTxCap: bigint; // USDC atomic (6dp)
  dailyCap: bigint; // USDC atomic (6dp)
  minReputation: number; // average must be >= this
  minFeedbackCount: number;
  paused: boolean;
}

export const DEFAULT_SAMPLE_POLICY: SamplePolicy = {
  perTxCap: 100_000_000n, // 100 USDC
  dailyCap: 500_000_000n, // 500 USDC
  minReputation: 70,
  minFeedbackCount: 1,
  paused: false,
};

/**
 * Live gate. If PolicyVault is deployed, calls gate() on-chain. Otherwise
 * computes a clear preview from the live reputation read + a sample policy,
 * mirroring PolicyVault.gate() ordering exactly.
 */
export async function runGate(params: {
  payer: `0x${string}`;
  payeeAgentId: bigint;
  amount: bigint; // USDC atomic
  clients: `0x${string}`[];
  policy?: SamplePolicy;
}): Promise<GateResult> {
  const { payer, payeeAgentId, amount, clients } = params;

  if (POLICY_VAULT_ADDRESS) {
    const [decision, reason] = await publicClient.readContract({
      address: POLICY_VAULT_ADDRESS,
      abi: policyVaultAbi,
      functionName: "gate",
      args: [payer, payeeAgentId, amount],
    });
    return {
      decision: DECISIONS[Number(decision)] ?? "DENY",
      reason,
      source: "onchain",
    };
  }

  // --- Client-side preview, mirroring PolicyVault.gate() ---
  const p = params.policy ?? DEFAULT_SAMPLE_POLICY;

  if (p.paused) return { decision: "DENY", reason: "killswitch active", source: "preview" };
  if (amount > p.perTxCap)
    return { decision: "DENY", reason: "exceeds per-tx cap", source: "preview" };
  if (amount > p.dailyCap)
    return { decision: "DENY", reason: "exceeds daily cap", source: "preview" };

  if (clients.length === 0) {
    return {
      decision: "REQUIRE_VALIDATION",
      reason: "no trusted attestors configured",
      source: "preview",
    };
  }

  const rep = await readReputation(payeeAgentId, clients);
  if (rep.count < p.minFeedbackCount) {
    return {
      decision: "REQUIRE_VALIDATION",
      reason: "payee: insufficient feedback from trusted attestors",
      source: "preview",
    };
  }
  if ((rep.average ?? 0) < p.minReputation) {
    return {
      decision: "DENY",
      reason: "payee: reputation below threshold",
      source: "preview",
    };
  }
  return { decision: "ALLOW", reason: "ok", source: "preview" };
}

export const decisionMeta: Record<
  Decision,
  { label: string; tone: "good" | "bad" | "warn"; blurb: string }
> = {
  ALLOW: {
    label: "ALLOW",
    tone: "good",
    blurb: "Payee is trusted. Payment proceeds — settle USDC at Monad speed.",
  },
  DENY: {
    label: "DENY",
    tone: "bad",
    blurb: "Payment blocked before any funds move. Your agent is protected.",
  },
  REQUIRE_VALIDATION: {
    label: "REQUIRE VALIDATION",
    tone: "warn",
    blurb: "Not enough trust signal. Hold for an explicit capability validation.",
  },
};
