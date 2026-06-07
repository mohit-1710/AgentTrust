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
  title: string;
  subtitle: string;
  payeeAgentId: bigint;
  amount: string; // human USDC
  /** The attestor set the payer trusts. */
  clients: `0x${string}`[];
  expected: "DENY" | "ALLOW" | "REQUIRE_VALIDATION";
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "scammer",
    title: "Scammer payee (low reputation)",
    subtitle:
      "Your agent is about to pay an agent your trusted attestors have rated badly.",
    payeeAgentId: 1764n,
    amount: "5",
    clients: [TRUSTED_ATTESTOR],
    expected: "DENY",
  },
  {
    key: "trusted",
    title: "Trusted payee (strong reputation)",
    subtitle:
      "A payee your trusted attestors have rated highly — the payment clears.",
    payeeAgentId: 1763n,
    amount: "5",
    clients: [TRUSTED_ATTESTOR],
    expected: "ALLOW",
  },
];
