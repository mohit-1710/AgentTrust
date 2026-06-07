/**
 * Read the AgentTrust gate for a live policy on Monad testnet and print the
 * decision. The deployer below has a live policy that ALLOWs a 1 USDC payment
 * to agent 1763.
 *
 * Run from the sdk/ dir:  pnpm build && node dist-examples/gate-check.js
 * or with tsx:            pnpm exec tsx examples/gate-check.ts
 */
import { createAgentTrustClient, gate } from "../src/index.js";

const PAYER = "0x56665935703ECE0d7b16193035dEafA5Cc679A85" as const;
const PAYEE_AGENT_ID = 1763n;
const ONE_USDC = 1_000_000n; // 6 decimals

async function main() {
  const clients = createAgentTrustClient();
  const result = await gate(PAYER, PAYEE_AGENT_ID, ONE_USDC, clients);

  console.log(`payer:        ${PAYER}`);
  console.log(`payeeAgentId: ${PAYEE_AGENT_ID}`);
  console.log(`amount:       1 USDC`);
  console.log(`decision:     ${result.decision}`);
  console.log(`reason:       ${result.reason}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
