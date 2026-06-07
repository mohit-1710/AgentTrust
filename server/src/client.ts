/**
 * AgentTrust x402 client demo.
 *
 * Uses @x402/fetch `wrapFetchWithPayment` with an EVM "exact" scheme so a request
 * to the protected resource will:
 *   1. Receive HTTP 402 + PaymentRequirements
 *   2. Sign an EIP-3009 transferWithAuthorization for USDC
 *   3. Retry with the X-PAYMENT header
 *   4. (server runs the AgentTrust gate, then facilitator verify+settle)
 *
 * Requires a wallet funded with Monad-testnet USDC to actually settle. Without
 * funds the request will reach the gate/verify step and the facilitator will
 * report an invalid/insufficient payment — still demonstrates the full flow.
 *
 * Env:
 *   CLIENT_PRIVATE_KEY  (preferred) or PRIVATE_KEY  — the paying agent's key
 *   SERVER_URL          default http://localhost:4021
 *   PAYEE_AGENT_ID      default 1
 */
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { config } from "./config.js";
import { monadTestnet } from "./chain.js";

const serverUrl = process.env.SERVER_URL ?? `http://localhost:${config.port}`;
const payeeAgentId = process.env.PAYEE_AGENT_ID ?? "1";

async function main() {
  const pk = (process.env.CLIENT_PRIVATE_KEY ?? config.privateKey ?? "").trim();
  if (!pk || !pk.startsWith("0x")) {
    throw new Error(
      "Set CLIENT_PRIVATE_KEY (0x-prefixed) to a Monad-testnet wallet funded with USDC.",
    );
  }

  const account = privateKeyToAccount(pk as `0x${string}`);

  // Compose a ClientEvmSigner from the account + a public client for reads.
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(config.rpcUrl),
  });
  const signer = toClientEvmSigner(account, publicClient);

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer,
    networks: [config.network],
    schemeOptions: { rpcUrl: config.rpcUrl },
  });

  const fetchWithPay = wrapFetchWithPayment(globalThis.fetch, client);

  const url = `${serverUrl}/protected/report`;
  console.log(`[client] paying agent: ${account.address}`);
  console.log(`[client] GET ${url} (payeeAgentId=${payeeAgentId})`);

  const res = await fetchWithPay(url, {
    headers: { "X-PAYEE-AGENT-ID": payeeAgentId },
  });

  const body = await res.text();
  console.log(`[client] status: ${res.status}`);
  const settleHeader = res.headers.get("X-PAYMENT-RESPONSE");
  if (settleHeader) console.log(`[client] X-PAYMENT-RESPONSE: ${settleHeader}`);
  try {
    console.log("[client] body:", JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log("[client] body:", body);
  }
}

main().catch((err) => {
  console.error("[client] error:", err);
  process.exit(1);
});
