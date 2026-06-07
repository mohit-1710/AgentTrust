import {
  createPublicClient,
  http,
  defineChain,
  getAddress,
  type Address,
} from "viem";
import { config } from "./config.js";

export const monadTestnet = defineChain({
  id: config.chainId,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(config.rpcUrl),
});

// --- PolicyVault ABI (only the gate read we need) ---
export const policyVaultAbi = [
  {
    type: "function",
    name: "gate",
    stateMutability: "view",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payeeAgentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "decision", type: "uint8" },
      { name: "reason", type: "string" },
    ],
  },
] as const;

export enum GateDecision {
  ALLOW = 0,
  DENY = 1,
  REQUIRE_VALIDATION = 2,
}

export interface GateResult {
  decision: GateDecision;
  reason: string;
  stubbed: boolean;
}

/**
 * Calls AgentTrust PolicyVault.gate(payer, payeeAgentId, amount).
 *
 * If POLICY_VAULT_ADDRESS is unset (contract not yet deployed), this is a
 * no-op stub that returns ALLOW so the end-to-end x402 flow stays demonstrable.
 */
export async function runGate(
  payer: Address,
  payeeAgentId: bigint,
  amount: bigint,
): Promise<GateResult> {
  if (!config.policyVaultAddress) {
    console.warn(
      "[gate] POLICY_VAULT_ADDRESS is empty — PolicyVault not deployed. " +
        "Stubbing decision=ALLOW. Set POLICY_VAULT_ADDRESS to enforce the real gate.",
    );
    return { decision: GateDecision.ALLOW, reason: "stub: vault not deployed", stubbed: true };
  }

  const [decision, reason] = (await publicClient.readContract({
    address: getAddress(config.policyVaultAddress),
    abi: policyVaultAbi,
    functionName: "gate",
    args: [getAddress(payer), payeeAgentId, amount],
  })) as [number, string];

  return { decision: decision as GateDecision, reason, stubbed: false };
}

// --- ERC-8004 Reputation Registry (read-only, optional enrichment) ---
export const reputationAbi = [
  {
    type: "function",
    name: "getSummary",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clients", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "summaryValue", type: "int128" },
      { name: "decimals", type: "uint8" },
    ],
  },
] as const;

/**
 * Reads an ERC-8004 reputation summary. NOTE: the registry reverts with
 * "clientAddresses required" when `clients` is empty, so callers must pass a
 * non-empty client list. Returns null on any error (best-effort enrichment).
 */
export async function readReputation(
  agentId: bigint,
  clients: Address[],
  tag1 = "",
  tag2 = "",
): Promise<{ count: bigint; summaryValue: bigint; decimals: number } | null> {
  if (!config.reputationRegistry || clients.length === 0) return null;
  try {
    const [count, summaryValue, decimals] = (await publicClient.readContract({
      address: getAddress(config.reputationRegistry),
      abi: reputationAbi,
      functionName: "getSummary",
      args: [agentId, clients.map((c) => getAddress(c)), tag1, tag2],
    })) as [bigint, bigint, number];
    return { count, summaryValue, decimals };
  } catch (err) {
    console.warn("[reputation] getSummary failed:", (err as Error).message);
    return null;
  }
}
