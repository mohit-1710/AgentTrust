import type { Address, Hash } from "viem";
import { getAddress } from "viem";
import type { AgentTrustClients } from "./chain.js";
import { ADDRESSES } from "./addresses.js";
import { policyVaultAbi } from "./abis.js";

/** A payer's self-sovereign policy. Each operator owns their own. */
export interface PolicyParams {
  /** Max amount per single payment, token atomic units (USDC = 6 decimals). */
  perTxCap: bigint;
  /** Max cumulative amount per rolling 24h window, token atomic units. */
  dailyCap: bigint;
  /** Payee AVERAGE ERC-8004 feedback value must be >= this (feedback scale). */
  minReputation: bigint;
  /** Payee must have at least this many feedback entries. */
  minFeedbackCount: bigint;
  /** Require a positive ERC-8004 validation for the payee. */
  requireValidation: boolean;
  /** Feedback authors whose ERC-8004 ratings this payer trusts (Sybil set). */
  acceptedClients: Address[];
}

function requireWallet(ctx: AgentTrustClients) {
  if (!ctx.wallet || !ctx.account) {
    throw new Error(
      "A wallet client is required for this write. Create the client with a privateKey: createAgentTrustClient({ privateKey }).",
    );
  }
  return { wallet: ctx.wallet, account: ctx.account };
}

/**
 * Set (or replace) the caller's PolicyVault policy. Self-sovereign: the policy
 * is keyed by msg.sender, so it applies to the wallet that signs this tx.
 */
export async function setPolicy(
  params: PolicyParams,
  ctx: AgentTrustClients,
): Promise<Hash> {
  const { wallet, account } = requireWallet(ctx);
  return wallet.writeContract({
    address: ADDRESSES.policyVault,
    abi: policyVaultAbi,
    functionName: "setPolicy",
    args: [
      params.perTxCap,
      params.dailyCap,
      params.minReputation,
      params.minFeedbackCount,
      params.requireValidation,
      params.acceptedClients.map((c) => getAddress(c)),
    ],
    account,
    chain: ctx.chain,
  });
}

/**
 * Flip the caller's emergency kill switch. While paused, the gate DENYs every
 * payment from this payer. Requires an existing policy.
 */
export async function setKillSwitch(
  paused: boolean,
  ctx: AgentTrustClients,
): Promise<Hash> {
  const { wallet, account } = requireWallet(ctx);
  return wallet.writeContract({
    address: ADDRESSES.policyVault,
    abi: policyVaultAbi,
    functionName: "setKillSwitch",
    args: [paused],
    account,
    chain: ctx.chain,
  });
}

/**
 * Record a spend against the caller's rolling 24h velocity window. Call this
 * after a payment settles so the daily-cap accounting stays accurate.
 *
 * @param amount spent amount in token atomic units (USDC = 6 decimals).
 */
export async function recordSpend(
  amount: bigint,
  ctx: AgentTrustClients,
): Promise<Hash> {
  const { wallet, account } = requireWallet(ctx);
  return wallet.writeContract({
    address: ADDRESSES.policyVault,
    abi: policyVaultAbi,
    functionName: "recordSpend",
    args: [amount],
    account,
    chain: ctx.chain,
  });
}
