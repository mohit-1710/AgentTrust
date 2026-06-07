import { createPublicClient, http } from "viem";
import { monadTestnet, MONAD_RPC } from "./chain";

/** Shared read-only public client against Monad testnet. */
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_RPC),
});
