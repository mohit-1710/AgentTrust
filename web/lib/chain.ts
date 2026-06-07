import { defineChain } from "viem";

export const MONAD_CHAIN_ID = 10143;
export const MONAD_RPC =
  process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz";
export const MONAD_EXPLORER = "https://testnet.monadexplorer.com";

/** Custom Monad testnet chain for viem/wagmi. */
export const monadTestnet = defineChain({
  id: MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_RPC] },
    public: { http: [MONAD_RPC] },
  },
  blockExplorers: {
    default: { name: "MonadExplorer", url: MONAD_EXPLORER },
  },
  testnet: true,
});

export function explorerTx(hash: string): string {
  return `${MONAD_EXPLORER}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${MONAD_EXPLORER}/address/${addr}`;
}
