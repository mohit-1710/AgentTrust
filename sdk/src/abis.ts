import { parseAbi } from "viem";

/**
 * AgentTrust PolicyVault. Every payer owns their own self-sovereign policy.
 * `gate` is a free view call meant to sit inline in the x402 verify->settle path.
 */
export const policyVaultAbi = parseAbi([
  "function gate(address payer, uint256 payeeAgentId, uint256 amount) view returns (uint8 decision, string reason)",
  "function setPolicy(uint256 perTxCap, uint256 dailyCap, int128 minReputation, uint64 minFeedbackCount, bool requireValidation, address[] acceptedClients)",
  "function setKillSwitch(bool paused)",
  "function recordSpend(uint256 amount)",
]);

/** ERC-8004 Reputation Registry. */
export const reputationAbi = parseAbi([
  "function getSummary(uint256 agentId, address[] clients, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
]);

/** ERC-8004 Identity Registry. */
export const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

/** ERC-8004 Validation Registry (read helper for the REQUIRE_VALIDATION path). */
export const validationAbi = parseAbi([
  "function getSummary(uint256 agentId, address[] validators, string tag) view returns (uint64 count, uint8 averageResponse)",
]);

/** Minimal ERC-20 surface (USDC balance/decimals). */
export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
