export interface HeroStat {
  readonly value: string;
  readonly label: string;
}

export const HERO_STATS: readonly HeroStat[] = [
  { value: "1", label: "Gate decision" },
  { value: "3", label: "ERC-8004 registries" },
  { value: "20", label: "Foundry tests" },
  { value: "MIT", label: "Open-source license" },
];

export const POLICY_CHECK_NAMES: readonly string[] = [
  "per_tx_cap",
  "daily_cap",
  "sliding_window_velocity",
  "multisig_kill_switch",
  "counterparty_reputation_threshold",
  "trusted_attestor_set",
  "capability_validation",
];
