/**
 * Live smoke test: read the ERC-8004 Reputation Registry on Monad testnet.
 * Run: pnpm rep:check
 *
 * Verified live data (2026-06): agentId=1 rated by trusted attestor
 * 0xb6E8B2692cdc3A31280DCa8E9C8b88bb5e436f24 → count=1, sum=90, avg=90.
 */
import { createPublicClient, http } from "viem";
import { monadTestnet } from "../lib/chain";
import { REPUTATION_REGISTRY, reputationAbi } from "../lib/contracts";

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

async function main() {
  const cases: { agentId: bigint; clients: `0x${string}`[]; note: string }[] = [
    {
      agentId: 1n,
      clients: ["0xb6E8B2692cdc3A31280DCa8E9C8b88bb5e436f24"],
      note: "trusted attestor → expect count=1, sum=90",
    },
    {
      agentId: 1n,
      clients: ["0x56665935703ECE0d7b16193035dEafA5Cc679A85"],
      note: "untrusted attestor → expect count=0 (no data)",
    },
  ];

  for (const c of cases) {
    const [count, summaryValue, decimals] = await client.readContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: "getSummary",
      args: [c.agentId, c.clients, "", ""],
    });
    const cnt = Number(count);
    const total = Number(summaryValue);
    const avg = cnt > 0 ? total / cnt : null;
    console.log(
      `agentId=${c.agentId} clients=${c.clients.length}  =>  count=${cnt} sum=${total} decimals=${decimals} avg=${avg}  [${c.note}]`
    );
  }
  console.log("\nLIVE READ OK — registry", REPUTATION_REGISTRY);
}

main().catch((e) => {
  console.error("READ FAILED:", e);
  process.exit(1);
});
