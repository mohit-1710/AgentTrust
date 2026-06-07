import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MONAD_TESTNET } from "./addresses.js";

/** Monad testnet (chainId 10143) as a viem chain. */
export const monadTestnet = defineChain({
  id: MONAD_TESTNET.chainId,
  name: "Monad Testnet",
  nativeCurrency: MONAD_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: [MONAD_TESTNET.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: MONAD_TESTNET.explorer },
  },
  testnet: true,
});

export interface AgentTrustClientOptions {
  /** Override the Monad testnet RPC URL. */
  rpcUrl?: string;
  /**
   * 0x-prefixed private key for the operator wallet. When provided, the returned
   * bundle includes a `wallet` client and `account` for write helpers
   * (setPolicy, giveFeedback, registerAgent, etc.). Read-only without it.
   */
  privateKey?: `0x${string}`;
}

/** Alias for {@link AgentTrustClients}. */
export type AgentTrustClient = AgentTrustClients;

export interface AgentTrustClients {
  /** viem public client for all reads (gate, reputation, balances). */
  public: PublicClient;
  /** viem wallet client for writes. Present only when a privateKey is supplied. */
  wallet?: WalletClient;
  /** The wallet account. Present only when a privateKey is supplied. */
  account?: ReturnType<typeof privateKeyToAccount>;
  /** The Monad testnet chain definition. */
  chain: typeof monadTestnet;
}

/**
 * Create the viem clients AgentTrust needs. A public client is always returned;
 * pass `privateKey` to also get a wallet client for on-chain writes.
 *
 * @example
 * const clients = createAgentTrustClient();                    // read-only
 * const signer  = createAgentTrustClient({ privateKey: "0x.." }); // read + write
 */
export function createAgentTrustClient(
  opts: AgentTrustClientOptions = {},
): AgentTrustClients {
  const rpcUrl = opts.rpcUrl ?? MONAD_TESTNET.rpcUrl;
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport,
  });

  if (!opts.privateKey) {
    return { public: publicClient, chain: monadTestnet };
  }

  const account = privateKeyToAccount(opts.privateKey);
  const wallet = createWalletClient({
    account,
    chain: monadTestnet,
    transport,
  });

  return { public: publicClient, wallet, account, chain: monadTestnet };
}
