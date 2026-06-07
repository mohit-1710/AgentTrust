import { getAddress } from "viem";

/** Monad testnet network constants (verified on-chain). */
export const MONAD_TESTNET = {
  chainId: 10143,
  /** CAIP-2 network id used by x402 (eip155:10143). */
  caip2: "eip155:10143" as const,
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadexplorer.com",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
} as const;

/**
 * Deployed contract addresses on Monad testnet (chainId 10143).
 *
 * - `policyVault`  — AgentTrust PolicyVault (the pre-payment gate). DEPLOYED.
 * - `identity`     — ERC-8004 Identity Registry.
 * - `reputation`   — ERC-8004 Reputation Registry.
 * - `validation`   — ERC-8004 Validation Registry.
 * - `usdc`         — USDC (6 decimals) used for x402 settlement.
 */
export const ADDRESSES = {
  policyVault: getAddress("0x34b3bB1a99377128126201359749FE7614275E37"),
  identity: getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e"),
  reputation: getAddress("0x8004B663056A597Dffe9eCcC1965A193B7388713"),
  validation: getAddress("0x8004Cb1BF31DAf7788923b405b754f57acEB4272"),
  usdc: getAddress("0x534b2f3A21130d7a60830c2Df862319e593943A3"),
} as const;

/** USDC has 6 decimals on Monad testnet. */
export const USDC_DECIMALS = 6;

/** x402 facilitator (verify + settle) for Monad testnet. */
export const X402_FACILITATOR_URL = "https://x402-facilitator.molandak.org";

/** Convenience helpers for the block explorer. */
export function explorerTx(hash: string): string {
  return `${MONAD_TESTNET.explorer}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${MONAD_TESTNET.explorer}/address/${address}`;
}
