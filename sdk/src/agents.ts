import type { Hash } from "viem";
import type { AgentTrustClients } from "./chain.js";
import { ADDRESSES } from "./addresses.js";
import { identityAbi, reputationAbi } from "./abis.js";

const ZERO_HASH = `0x${"0".repeat(64)}` as `0x${string}`;

function requireWallet(ctx: AgentTrustClients) {
  if (!ctx.wallet || !ctx.account) {
    throw new Error(
      "A wallet client is required for this write. Create the client with a privateKey: createAgentTrustClient({ privateKey }).",
    );
  }
  return { wallet: ctx.wallet, account: ctx.account };
}

/**
 * Register a new agent in the ERC-8004 Identity Registry. Returns the tx hash;
 * read the minted agentId from the receipt / Transfer event.
 *
 * @param agentURI public URL of the agent's registration JSON.
 */
export async function registerAgent(
  agentURI: string,
  ctx: AgentTrustClients,
): Promise<Hash> {
  const { wallet, account } = requireWallet(ctx);
  return wallet.writeContract({
    address: ADDRESSES.identity,
    abi: identityAbi,
    functionName: "register",
    args: [agentURI],
    account,
    chain: ctx.chain,
  });
}

export interface FeedbackOptions {
  /** Decimal scale of `value` (v1 registry uses 0). */
  valueDecimals?: number;
  /** Optional category tags. */
  tag1?: string;
  tag2?: string;
  /** Optional endpoint and off-chain feedback URI / hash. */
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: `0x${string}`;
}

/**
 * Submit feedback for an agent to the ERC-8004 Reputation Registry. Positive
 * values build trust; negative values flag bad actors.
 *
 * @param agentId agent being rated.
 * @param value   feedback value (positive = good, negative = bad).
 */
export async function giveFeedback(
  agentId: bigint,
  value: bigint,
  ctx: AgentTrustClients,
  opts: FeedbackOptions = {},
): Promise<Hash> {
  const { wallet, account } = requireWallet(ctx);
  return wallet.writeContract({
    address: ADDRESSES.reputation,
    abi: reputationAbi,
    functionName: "giveFeedback",
    args: [
      agentId,
      value,
      opts.valueDecimals ?? 0,
      opts.tag1 ?? "quality",
      opts.tag2 ?? "",
      opts.endpoint ?? "",
      opts.feedbackURI ?? "",
      opts.feedbackHash ?? ZERO_HASH,
    ],
    account,
    chain: ctx.chain,
  });
}
