/**
 * Demo fixtures. Values are LIVE on Monad testnet (verified on-chain 2026-06):
 *   - agentId 1 rated by 0xb6E8…436f24 → count=1, sum=90, avg=90 (TRUSTED)
 *   - agentId 1 rated by an attestor you don't trust → count=0 (NO DATA → blocked)
 */
export const TRUSTED_ATTESTOR =
  "0xb6E8B2692cdc3A31280DCa8E9C8b88bb5e436f24" as const;

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
    title: "Unknown payee (the scammer)",
    subtitle:
      "Your agent is asked to pay an agent with zero ratings from anyone you trust.",
    payeeAgentId: 1n,
    amount: "25",
    // Trusting an attestor who never rated this payee ⇒ count 0 ⇒ blocked.
    clients: [SAMPLE_PAYER],
    expected: "REQUIRE_VALIDATION",
  },
  {
    key: "trusted",
    title: "Vetted payee (trusted)",
    subtitle:
      "Same payee — but now rated by an attestor you trust, with a strong score.",
    payeeAgentId: 1n,
    amount: "25",
    clients: [TRUSTED_ATTESTOR],
    expected: "ALLOW",
  },
];
