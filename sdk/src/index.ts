// AgentTrust SDK — pre-payment policy gate for agents on Monad testnet.
// ERC-8004 reputation + PolicyVault gate + x402 settlement, in a few lines.

export {
  ADDRESSES,
  MONAD_TESTNET,
  USDC_DECIMALS,
  X402_FACILITATOR_URL,
  explorerTx,
  explorerAddress,
} from "./addresses.js";

export {
  policyVaultAbi,
  reputationAbi,
  identityAbi,
  validationAbi,
  erc20Abi,
} from "./abis.js";

export {
  monadTestnet,
  createAgentTrustClient,
  type AgentTrustClient,
  type AgentTrustClients,
  type AgentTrustClientOptions,
} from "./chain.js";

export {
  getReputation,
  trustVerdict,
  type ReputationResult,
  type TrustVerdict,
  type VerdictResult,
} from "./reputation.js";

export {
  gate,
  DECISIONS,
  decisionMeta,
  type Decision,
  type GateResult,
  type DecisionMeta,
} from "./gate.js";

export {
  setPolicy,
  setKillSwitch,
  recordSpend,
  type PolicyParams,
} from "./policy.js";

export {
  registerAgent,
  giveFeedback,
  type FeedbackOptions,
} from "./agents.js";

export {
  createPaymentClient,
  payThroughGate,
  SERVER_FLOW_NOTE,
  type PaymentClient,
  type PaymentClientOptions,
} from "./x402.js";
