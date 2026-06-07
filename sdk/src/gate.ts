import type { Address } from "viem";
import { getAddress } from "viem";
import type { AgentTrustClients } from "./chain.js";
import { ADDRESSES } from "./addresses.js";
import { policyVaultAbi } from "./abis.js";

export type Decision = "ALLOW" | "DENY" | "REQUIRE_VALIDATION";

/** Maps the on-chain uint8 decision enum to its name. */
export const DECISIONS: readonly Decision[] = [
  "ALLOW",
  "DENY",
  "REQUIRE_VALIDATION",
] as const;

export interface GateResult {
  /** Decoded PolicyVault decision. */
  decision: Decision;
  /** Human-readable reason string returned by the contract. */
  reason: string;
  /** Raw uint8 decision as returned on-chain. */
  raw: number;
}

export interface DecisionMeta {
  label: string;
  tone: "good" | "bad" | "warn";
  blurb: string;
}

export const decisionMeta: Record<Decision, DecisionMeta> = {
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
    blurb:
      "Not enough trust signal. Hold for an explicit capability validation.",
  },
};

/**
 * Ask the AgentTrust PolicyVault whether a payment should proceed. This is a
 * free `view` call that reads the payer's own policy and the payee's ERC-8004
 * reputation, returning ALLOW / DENY / REQUIRE_VALIDATION.
 *
 * @param payer        the agent operator about to pay.
 * @param payeeAgentId ERC-8004 agent id of the counterparty being paid.
 * @param amount       payment amount in token atomic units (USDC = 6 decimals).
 */
export async function gate(
  payer: Address,
  payeeAgentId: bigint,
  amount: bigint,
  ctx: AgentTrustClients,
): Promise<GateResult> {
  const [decision, reason] = await ctx.public.readContract({
    address: ADDRESSES.policyVault,
    abi: policyVaultAbi,
    functionName: "gate",
    args: [getAddress(payer), payeeAgentId, amount],
  });

  const raw = Number(decision);
  return {
    decision: DECISIONS[raw] ?? "DENY",
    reason,
    raw,
  };
}
