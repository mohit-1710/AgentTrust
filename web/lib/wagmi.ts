import { http, createConfig } from "wagmi";
import { monadTestnet, MONAD_RPC } from "./chain";

/** Wagmi config with the custom Monad testnet chain. */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(MONAD_RPC),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
