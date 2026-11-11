export interface HeroStat {
  readonly value: string;
  readonly label: string;
}

export const HERO_STATS: readonly HeroStat[] = [
  { value: "3", label: "Trust checks" },
  { value: "1 tx", label: "Atomic settlement" },
  { value: "7 / 7", label: "Invariants verified" },
  { value: "MIT", label: "Open-source license" },
];

export const KANI_HARNESS_NAMES: readonly string[] = [
  "paused_implies_no_allow",
  "velocity_counter_le_limit",
  "counterparty_tier_monotone",
  "validation_expiry_correct",
  "multisig_threshold_enforced",
  "gate_payment_strict_correctness",
  "spending_allow_respects_caps",
];
