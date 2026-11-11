export const PROGRAM_IDS = {
  devnet: {
    policyVault: '8Y6fGeNEHgmWmbt8JsRcF72jxbeBfJhomMjG6SuoJQTR',
    trustgate: 'HF8zHfoyA7b5mhLViopTnRMprc6ZT5KActHTdkFrih2N',
    validationRegistry: 'Cx4RFa6ysw3qXYhugPkF8pFSWBkmKq59h2dWgF2tKhtv',
  },
  quantuMainnet: {
    agentRegistry8004: '8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ',
    atomEngine: 'AToMw53aiPQ8j7iHVb4fGt6nzUNxUhcPc3tbPBZuzVVb',
  },
  quantuDevnet: {
    agentRegistry8004: '8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C',
    atomEngine: 'AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF',
  },
} as const;

export const KANI_HARNESSES = [
  'paused_implies_no_allow',
  'velocity_counter_le_limit',
  'counterparty_tier_monotone',
  'validation_expiry_correct',
  'multisig_threshold_enforced',
  'gate_payment_strict_correctness',
  'spending_allow_respects_caps',
] as const;

export const KANI_TOTAL_SUB_CHECKS = 662;

export const SDK_PACKAGE = '@agenttrust-sdk/trustgate';
export const GITHUB_REPO = 'github.com/agenttrust-labs/agenttrust';
export const LICENSE = 'MIT';

export const POLICY_ORDER = [
  'KillSwitch',
  'Spending',
  'Velocity',
  'CounterpartyTier',
  'RequireValidation',
] as const;

export const DENY_REASON_NAMES = [
  'KillSwitchEngaged',
  'SpendingPerTxExceeded',
  'SpendingDailyExceeded',
  'SpendingWeeklyExceeded',
  'VelocityWindowExceeded',
  'CounterpartyTierBelowMin',
  'CounterpartyRiskAboveMax',
  'CounterpartyConfidenceBelow',
  'AtomStatsWrongOwner',
  'AtomStatsSchemaMismatch',
  'AttestationMissing',
  'AttestationExpired',
  'AttestationRevoked',
  'AttestationAttestorRejected',
  'UnratedTreatmentDeny',
] as const;
