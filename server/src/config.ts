import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The canonical .env lives at the repo root (one level up from server/).
// Fall back to a local server/.env if present.
loadDotenv({ path: resolve(__dirname, "../../.env") });
loadDotenv({ path: resolve(__dirname, "../.env") });

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4021),

  // Monad testnet
  rpcUrl: req("MONAD_TESTNET_RPC", "https://testnet-rpc.monad.xyz"),
  chainId: Number(req("MONAD_TESTNET_CHAIN_ID", "10143")),
  // x402 networks are CAIP-2 style: "eip155:10143"
  network: `eip155:${Number(req("MONAD_TESTNET_CHAIN_ID", "10143"))}` as const,

  // Token + facilitator
  usdc: req("USDC_TESTNET", "0x534b2f3A21130d7a60830c2Df862319e593943A3") as `0x${string}`,
  facilitatorUrl: req("X402_FACILITATOR", "https://x402-facilitator.molandak.org"),

  // AgentTrust gate (MAY be empty until deployed)
  policyVaultAddress: (process.env.POLICY_VAULT_ADDRESS ?? "").trim() as
    | `0x${string}`
    | "",

  // ERC-8004 reputation (read-only, live)
  reputationRegistry: (process.env.REPUTATION_REGISTRY ?? "").trim() as
    | `0x${string}`
    | "",

  // Server settlement signer (the resource server's wallet that receives USDC).
  // Used as default payTo and as the facilitator-facing signer reference.
  privateKey: (process.env.PRIVATE_KEY ?? "").trim() as `0x${string}` | "",
  payToOverride: (process.env.PAY_TO ?? "").trim() as `0x${string}` | "",

  // Demo price: 0.01 USDC (6 decimals) -> "10000" atomic units.
  priceAtomic: process.env.PRICE_ATOMIC ?? "10000",
};

export type AppConfig = typeof config;
