import { createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { monadTestnet } from "./chain.js";
import { MONAD_TESTNET } from "./addresses.js";

export interface PaymentClientOptions {
  /** 0x-prefixed key of the paying agent (must hold Monad-testnet USDC). */
  privateKey: `0x${string}`;
  /** Override the Monad testnet RPC URL. */
  rpcUrl?: string;
  /** Base fetch to wrap. Defaults to the global fetch. */
  baseFetch?: typeof fetch;
}

export interface PaymentClient {
  /** Address of the paying agent. */
  payer: Address;
  /**
   * Drop-in `fetch` that transparently pays gated x402 endpoints: it handles the
   * 402 challenge, signs an EIP-3009 USDC authorization (exact scheme), and
   * retries with the X-PAYMENT header. The resource server runs the AgentTrust
   * gate before it settles.
   */
  fetch: typeof fetch;
}

/**
 * Build a payment-capable fetch for the AgentTrust x402 flow on Monad testnet
 * (exact scheme, USDC, eip155:10143).
 *
 * @example
 * const { fetch: payFetch } = createPaymentClient({ privateKey });
 * const res = await payFetch(url, { headers: { "X-PAYEE-AGENT-ID": "1763" } });
 */
export function createPaymentClient(
  opts: PaymentClientOptions,
): PaymentClient {
  const account = privateKeyToAccount(opts.privateKey);
  const rpcUrl = opts.rpcUrl ?? MONAD_TESTNET.rpcUrl;

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  });

  const signer = toClientEvmSigner(account, publicClient);

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer,
    networks: [MONAD_TESTNET.caip2],
    schemeOptions: { rpcUrl },
  });

  const base = opts.baseFetch ?? globalThis.fetch;
  const payFetch = wrapFetchWithPayment(base, client) as typeof fetch;

  return { payer: account.address, fetch: payFetch };
}

/**
 * Convenience wrapper: GET a single AgentTrust-gated x402 resource and return
 * the response. `payeeAgentId` is forwarded so the server can gate the payment.
 */
export async function payThroughGate(params: {
  url: string;
  privateKey: `0x${string}`;
  payeeAgentId: bigint | string;
  rpcUrl?: string;
  init?: RequestInit;
}): Promise<Response> {
  const { fetch: payFetch } = createPaymentClient({
    privateKey: params.privateKey,
    rpcUrl: params.rpcUrl,
  });

  const init: RequestInit = { ...params.init };
  init.headers = {
    ...(params.init?.headers as Record<string, string> | undefined),
    "X-PAYEE-AGENT-ID": String(params.payeeAgentId),
  };

  return payFetch(params.url, init);
}

/**
 * Server-side note (verify -> gate -> settle).
 *
 * The resource server keeps the AgentTrust gate INLINE in the standard x402
 * path. For a runnable reference implementation see `server/src/server.ts`,
 * which:
 *
 *   1. Replies 402 with x402 PaymentRequirements (exact, USDC, eip155:10143).
 *   2. Decodes the client's X-PAYMENT header to recover the payer + amount.
 *   3. Calls `gate(payer, payeeAgentId, amount)` (this SDK's `gate`) and only
 *      proceeds on ALLOW; DENY -> 403, REQUIRE_VALIDATION -> 402.
 *   4. On ALLOW: facilitator.verify(), then facilitator.settle(), then serves
 *      the resource with the X-PAYMENT-RESPONSE header.
 *
 * Use the x402 facilitator at `X402_FACILITATOR_URL` (exported from this SDK)
 * via `new HTTPFacilitatorClient({ url })` from `@x402/core/http`.
 */
export const SERVER_FLOW_NOTE =
  "verify -> gate(ALLOW/DENY/REQUIRE_VALIDATION) -> settle; reference: server/src/server.ts";
