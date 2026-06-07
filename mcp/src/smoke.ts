/**
 * Smoke test: exercises the MCP's on-chain read path against the DEPLOYED
 * PolicyVault + ERC-8004 Reputation Registry on Monad testnet.
 * Run: pnpm exec tsx src/smoke.ts   (loads mcp/.env)
 */
import { publicClient, ADDRESSES, reputationAbi, policyVaultAbi } from "./chain.js";

const DECISIONS = ["ALLOW", "DENY", "REQUIRE_VALIDATION"] as const;
const ATTESTOR = "0x56665935703ECE0d7b16193035dEafA5Cc679A85" as `0x${string}`;
const AMOUNT = 1_000_000n; // 1 USDC

async function reputation(agentId: bigint) {
  const [count, summaryValue, dec] = await publicClient.readContract({
    address: ADDRESSES.reputation,
    abi: reputationAbi,
    functionName: "getSummary",
    args: [agentId, [ATTESTOR], "", ""],
  });
  return { count: Number(count), summaryValue: Number(summaryValue), decimals: dec };
}

async function gate(agentId: bigint) {
  const [decision, reason] = await publicClient.readContract({
    address: ADDRESSES.policyVault as `0x${string}`,
    abi: policyVaultAbi,
    functionName: "gate",
    args: [ATTESTOR, agentId, AMOUNT],
  });
  return { decision: DECISIONS[Number(decision)] ?? "UNKNOWN", reason };
}

async function main() {
  console.log("PolicyVault:", ADDRESSES.policyVault);
  for (const [label, id] of [["good", 1763n], ["scammer", 1764n], ["unknown", 999999n]] as const) {
    const rep = await reputation(id).catch((e) => `read error: ${String(e).slice(0, 60)}`);
    const g = await gate(id);
    console.log(`${label} (${id}): rep=${JSON.stringify(rep)} -> ${g.decision} "${g.reason}"`);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
