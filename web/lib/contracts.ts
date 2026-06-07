import { getAddress, isAddress } from "viem";

/** ERC-8004 Reputation Registry — LIVE on Monad testnet (verified on-chain). */
export const REPUTATION_REGISTRY = getAddress(
  "0x8004B663056A597Dffe9eCcC1965A193B7388713"
);

/** ERC-8004 Identity Registry — LIVE on Monad testnet. */
export const IDENTITY_REGISTRY = getAddress(
  "0x8004A818BFB912233c491871b3d84c89A494BD9e"
);

/** ERC-8004 Validation Registry — LIVE on Monad testnet. */
export const VALIDATION_REGISTRY = getAddress(
  "0x8004Cb1BF31DAf7788923b405b754f57acEB4272"
);

/** USDC testnet (6dp). */
export const USDC = getAddress("0x534b2f3A21130d7a60830c2Df862319e593943A3");

/** PolicyVault — deployed later; may be empty. Handle gracefully. */
export const POLICY_VAULT_ADDRESS: `0x${string}` | null = (() => {
  const a = process.env.NEXT_PUBLIC_POLICY_VAULT_ADDRESS;
  if (a && isAddress(a)) return getAddress(a);
  return null;
})();

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
      { name: "summaryValueDecimals", type: "uint8" },
    ],
  },
] as const;

export const identityAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

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
