/**
 * AgentTrust live "blocked -> allowed" demo seeder.
 *
 * Seeds the DEPLOYED PolicyVault on Monad testnet with real on-chain state:
 *   - a GOOD agent (high reputation)   -> gate ALLOW
 *   - a SCAMMER agent (low reputation) -> gate DENY
 *   - an UNKNOWN agentId               -> gate REQUIRE_VALIDATION
 *
 * Run: pnpm install && pnpm tsx seed-demo.ts
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  defineChain,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load private key from the repo-root .env (one level up from demo/)
dotenvConfig({ path: resolve(__dirname, "../.env") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RPC_URL = "https://testnet-rpc.monad.xyz";
const EXPLORER = "https://testnet.monadexplorer.com";

const POLICY_VAULT = "0x34b3bB1a99377128126201359749FE7614275E37" as Address;
const IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address;
const REPUTATION = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address;

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadExplorer", url: EXPLORER } },
});

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const identityAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

const reputationAbi = [
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const policyVaultAbi = [
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "perTxCap", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
      { name: "minReputation", type: "int128" },
      { name: "minFeedbackCount", type: "uint64" },
      { name: "requireValidation", type: "bool" },
      { name: "acceptedClients", type: "address[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "gate",
    stateMutability: "view",
    inputs: [
      { name: "payer", type: "address" },
      { name: "payeeAgentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "decision", type: "uint8" },
      { name: "reason", type: "string" },
    ],
  },
] as const;

const ZERO32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

const DECISION_LABEL: Record<number, string> = {
  0: "ALLOW",
  1: "DENY",
  2: "REQUIRE_VALIDATION",
};

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const pk = process.env.PRIVATE_KEY;
if (!pk) throw new Error("PRIVATE_KEY missing in ../.env");
const account = privateKeyToAccount(
  (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex
);

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC_URL),
});
const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(RPC_URL),
});

// The deployed ERC-8004 Reputation registry rejects "Self-feedback" — the
// feedback author (msg.sender) may not be the owner of the agent being rated.
// In AgentTrust's real model that's correct: the PAYER attests about a
// COUNTERPARTY agent owned by someone else. So we register the demo agents
// under a fresh ephemeral owner wallet (funded from the deployer), while the
// deployer remains the trusted feedback author + payer + acceptedClient.
const agentOwnerAccount = privateKeyToAccount(generatePrivateKey());
const agentOwnerWallet = createWalletClient({
  account: agentOwnerAccount,
  chain: monadTestnet,
  transport: http(RPC_URL),
});

const GAS = { register: 600_000n, feedback: 600_000n, policy: 1_000_000n, fund: 50_000n };

const txLink = (h: string) => `${EXPLORER}/tx/${h}`;

async function sendAndWait(
  label: string,
  hashPromise: Promise<Hex>
): Promise<{ hash: Hex; receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> }> {
  const hash = await hashPromise;
  console.log(`  [${label}] sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(
    `  [${label}] status=${receipt.status} block=${receipt.blockNumber} gasUsed=${receipt.gasUsed}`
  );
  if (receipt.status !== "success") {
    throw new Error(`${label} reverted (tx ${hash})`);
  }
  return { hash, receipt };
}

// Monad executes optimistically; right after a fresh account is funded the RPC
// can transiently reject a spend with "Signer had insufficient balance" until
// the funded state settles. Retry a few times with a short backoff.
async function withInsufficientBalanceRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 6
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes("insufficient balance") && i < attempts) {
        console.log(
          `  [${label}] transient insufficient-balance (attempt ${i}/${attempts}), retrying in 2s...`
        );
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label} exhausted retries`);
}

async function registerAgent(name: string, agentURI: string) {
  console.log(`\nRegistering ${name} agent (${agentURI})...`);
  const { hash, receipt } = await withInsufficientBalanceRetry(
    `register:${name}`,
    () =>
      sendAndWait(
        `register:${name}`,
        agentOwnerWallet.writeContract({
          address: IDENTITY,
          abi: identityAbi,
          functionName: "register",
          args: [agentURI],
          gas: GAS.register,
        })
      )
  );

  const logs = parseEventLogs({
    abi: identityAbi,
    eventName: "Registered",
    logs: receipt.logs,
  });
  if (logs.length === 0) {
    throw new Error(`No Registered event found for ${name} (tx ${hash})`);
  }
  const agentId = logs[0].args.agentId as bigint;
  console.log(`  ${name} agentId = ${agentId}`);
  return { agentId, hash };
}

async function giveFeedback(
  agentId: bigint,
  value: bigint,
  i: number
) {
  const { hash } = await sendAndWait(
    `feedback:${agentId}#${i}`,
    walletClient.writeContract({
      address: REPUTATION,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [agentId, value, 0, "quality", "finance", "", "", ZERO32],
      gas: GAS.feedback,
    })
  );
  return hash;
}

async function readGate(payer: Address, agentId: bigint, amount: bigint) {
  const [decision, reason] = await publicClient.readContract({
    address: POLICY_VAULT,
    abi: policyVaultAbi,
    functionName: "gate",
    args: [payer, agentId, amount],
  });
  return {
    decision: Number(decision),
    label: DECISION_LABEL[Number(decision)] ?? `UNKNOWN(${decision})`,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("AgentTrust PolicyVault demo seeder");
  console.log("==================================");
  console.log(`RPC:        ${RPC_URL}`);
  console.log(`Attestor:   ${account.address}`);
  console.log(`PolicyVault ${POLICY_VAULT}`);
  console.log(`Identity    ${IDENTITY}`);
  console.log(`Reputation  ${REPUTATION}`);

  const bal = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:    ${Number(bal) / 1e18} MON`);
  console.log(`AgentOwner  ${agentOwnerAccount.address} (ephemeral, owns demo agents)`);

  // Fund the ephemeral agent-owner so it can pay gas for 2 register txs.
  // Monad charges gas_limit, so fund enough for 2 * register gas at base fee + margin.
  const FUND_AMOUNT = 500_000_000_000_000_000n; // 0.5 MON
  const ownerBalBefore = await publicClient.getBalance({
    address: agentOwnerAccount.address,
  });
  if (ownerBalBefore < FUND_AMOUNT) {
    console.log(`\nFunding ephemeral agent-owner with 0.5 MON...`);
    await sendAndWait(
      "fund:agentOwner",
      walletClient.sendTransaction({
        to: agentOwnerAccount.address,
        value: FUND_AMOUNT,
        gas: GAS.fund,
      })
    );
    // Monad RPC balance can lag the funding receipt for a brand-new account;
    // poll until the FINALIZED state reflects the credited balance before
    // registering, then give it an extra moment to settle.
    console.log(`  waiting for agent-owner finalized balance to settle...`);
    for (let i = 0; i < 40; i++) {
      let fin = 0n;
      try {
        fin = await publicClient.getBalance({
          address: agentOwnerAccount.address,
          blockTag: "finalized",
        });
      } catch {
        /* finalized tag may briefly be unavailable */
      }
      if (fin >= FUND_AMOUNT) {
        console.log(`  agent-owner finalized balance = ${Number(fin) / 1e18} MON`);
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    console.log(
      `\nAgent-owner already funded (${Number(ownerBalBefore) / 1e18} MON), skipping fund.`
    );
  }

  // 1 & 2: register agents
  const good = await registerAgent(
    "GOOD",
    "https://agenttrust.local/agents/good.json"
  );
  const scammer = await registerAgent(
    "SCAMMER",
    "https://agenttrust.local/agents/scammer.json"
  );

  const registerTxs = { good: good.hash, scammer: scammer.hash };
  const feedbackTxs: { good: string[]; scammer: string[] } = {
    good: [],
    scammer: [],
  };

  // 3: 3x positive feedback for GOOD (value 90)
  console.log(`\nGiving 3x positive feedback (value=90) to GOOD (${good.agentId})...`);
  for (let i = 1; i <= 3; i++) {
    feedbackTxs.good.push(await giveFeedback(good.agentId, 90n, i));
  }

  // 4: 3x negative feedback for SCAMMER (value -60)
  console.log(`\nGiving 3x negative feedback (value=-60) to SCAMMER (${scammer.agentId})...`);
  for (let i = 1; i <= 3; i++) {
    feedbackTxs.scammer.push(await giveFeedback(scammer.agentId, -60n, i));
  }

  // 5: set policy
  //
  // Reputation-math note (verified against the DEPLOYED registry + PolicyVault):
  //   - The deployed ERC-8004 Reputation registry's getSummary returns the
  //     AVERAGE feedback value as `summaryValue` (e.g. 3x value=90 -> 90, count=3).
  //   - PolicyVault.gate compares that average directly to minReputation.
  //     So GOOD's effective score is 90 and SCAMMER's is -60.
  //   - With minReputation = 50: GOOD (90) >= 50 -> ALLOW, SCAMMER (-60) < 50
  //     -> DENY, unknown agent (count 0 < minFeedbackCount) -> REQUIRE_VALIDATION.
  const minReputation = 50n;
  console.log(`\nSetting payer policy for attestor (minReputation=${minReputation})...`);
  const { hash: policyTx } = await sendAndWait(
    "setPolicy",
    walletClient.writeContract({
      address: POLICY_VAULT,
      abi: policyVaultAbi,
      functionName: "setPolicy",
      args: [
        10_000_000n, // perTxCap = 10 USDC (6 decimals)
        100_000_000n, // dailyCap = 100 USDC
        minReputation, // minReputation (see note above re: deployed registry math)
        1n, // minFeedbackCount
        false, // requireValidation
        [account.address], // acceptedClients = trusted feedback author
      ],
      gas: GAS.policy,
    })
  );

  // 6,7,8: read gate
  console.log(`\nReading gate decisions...`);
  const amount = 1_000_000n; // 1 USDC
  const gGood = await readGate(account.address, good.agentId, amount);
  console.log(`  GOOD    -> ${gGood.label} : "${gGood.reason}"`);
  const gScammer = await readGate(account.address, scammer.agentId, amount);
  console.log(`  SCAMMER -> ${gScammer.label} : "${gScammer.reason}"`);
  const gUnknown = await readGate(account.address, 999999n, amount);
  console.log(`  UNKNOWN -> ${gUnknown.label} : "${gUnknown.reason}"`);

  // Write output
  const out = {
    network: "monad-testnet",
    chainId: 10143,
    explorer: EXPLORER,
    attestor: account.address,
    agentOwner: agentOwnerAccount.address,
    contracts: {
      policyVault: POLICY_VAULT,
      identity: IDENTITY,
      reputation: REPUTATION,
    },
    goodAgentId: good.agentId.toString(),
    scammerAgentId: scammer.agentId.toString(),
    unknownAgentId: "999999",
    registerTxs,
    feedbackTxs,
    policyTx,
    gate: {
      good: { ...gGood, agentId: good.agentId.toString() },
      scammer: { ...gScammer, agentId: scammer.agentId.toString() },
      unknown: { ...gUnknown, agentId: "999999" },
    },
  };

  const outPath = resolve(__dirname, "seed-output.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);

  // Verify expectations
  console.log("\nResult summary");
  console.log("--------------");
  const checks = [
    ["GOOD == ALLOW", gGood.decision === 0],
    ["SCAMMER == DENY", gScammer.decision === 1],
    ["UNKNOWN == REQUIRE_VALIDATION", gUnknown.decision === 2],
  ] as const;
  let allOk = true;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) allOk = false;
  }
  console.log(`\nExplorer links:`);
  console.log(`  GOOD register:    ${txLink(registerTxs.good)}`);
  console.log(`  SCAMMER register: ${txLink(registerTxs.scammer)}`);
  console.log(`  setPolicy:        ${txLink(policyTx)}`);

  if (!allOk) {
    throw new Error("One or more gate decisions did not match expectations.");
  }
  console.log("\nAll gate decisions match expectations. Done.");
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
