import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** Monad testnet (chainId 10143). */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_TESTNET_RPC ?? "https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

/** Verified on-chain (cast code, 2026-06-07). Overridable via .env. */
export const ADDRESSES = {
  identity: (process.env.IDENTITY_REGISTRY ??
    "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`,
  reputation: (process.env.REPUTATION_REGISTRY ??
    "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`,
  validation: (process.env.VALIDATION_REGISTRY ??
    "0x8004Cb1BF31DAf7788923b405b754f57acEB4272") as `0x${string}`,
  usdc: (process.env.USDC_TESTNET ??
    "0x534b2f3A21130d7a60830c2Df862319e593943A3") as `0x${string}`,
  policyVault: (process.env.POLICY_VAULT_ADDRESS ?? "") as `0x${string}` | "",
};

export const reputationAbi = parseAbi([
  "function getSummary(uint256 agentId, address[] clients, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
]);

export const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

export const policyVaultAbi = parseAbi([
  "function gate(address payer, uint256 payeeAgentId, uint256 amount) view returns (uint8 decision, string reason)",
  "function setPolicy(uint256 perTxCap, uint256 dailyCap, int128 minReputation, uint64 minFeedbackCount, bool requireValidation, address[] acceptedClients)",
  "function setKillSwitch(bool paused)",
]);

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export function getWallet() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY not set in .env");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({ account, chain: monadTestnet, transport: http() });
}
