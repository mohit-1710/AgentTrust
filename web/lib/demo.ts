/**
 * Demo fixtures — LIVE on Monad testnet (seeded + verified on-chain 2026-06-07):
 *   - agentId 1763 rated +90 ×3 by the trusted attestor → avg 90 → ALLOW
 *   - agentId 1764 rated -60 ×3 by the trusted attestor → avg -60 → DENY
 *   - an unknown agentId → no ratings from trusted attestors → REQUIRE_VALIDATION
 * The trusted attestor is also the payer / policy owner configured in PolicyVault.
 */
export const TRUSTED_ATTESTOR =
  "0x56665935703ECE0d7b16193035dEafA5Cc679A85" as const;

export const SAMPLE_PAYER =
  "0x56665935703ECE0d7b16193035dEafA5Cc679A85" as const;

export interface DemoScenario {
  key: "scammer" | "trusted";
  /** Short payee label shown on the card. */
  payeeLabel: string;
  title: string;
  subtitle: string;
  payeeAgentId: bigint;
  amount: string; // human USDC
  /** The attestor set the payer trusts. */
  clients: `0x${string}`[];
  expected: "DENY" | "ALLOW" | "REQUIRE_VALIDATION";
  /** One-line explanation of WHY this verdict happens — for narration. */
  why: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "scammer",
    payeeLabel: "Scammer agent",
    title: "Paying a scammer",
    subtitle:
      "Your agent is about to pay an agent your trusted attestors rated badly.",
    payeeAgentId: 1764n,
    amount: "5",
    clients: [TRUSTED_ATTESTOR],
    expected: "DENY",
    why: "The payee's average ERC-8004 reputation sits below the payer's trust threshold, so the gate blocks the payment before any USDC moves.",
  },
  {
    key: "trusted",
    payeeLabel: "Trusted agent",
    title: "Paying a trusted agent",
    subtitle:
      "Same agent, same amount — a payee your attestors rated highly.",
    payeeAgentId: 1763n,
    amount: "5",
    clients: [TRUSTED_ATTESTOR],
    expected: "ALLOW",
    why: "The payee clears the reputation threshold and the amount is within the payer's per-tx and daily caps, so the gate allows settlement over x402.",
  },
];
