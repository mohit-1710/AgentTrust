import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  publicClient,
  getWallet,
  ADDRESSES,
  reputationAbi,
  identityAbi,
  policyVaultAbi,
} from "./chain.js";

const DECISIONS = ["ALLOW", "DENY", "REQUIRE_VALIDATION"] as const;
const ZERO_HASH = `0x${"0".repeat(64)}` as `0x${string}`;

const server = new McpServer({ name: "agenttrust", version: "0.1.0" });

/** READ — payee reputation from the live ERC-8004 Reputation Registry on Monad. */
server.tool(
  "get_reputation",
  "Read an agent's on-chain ERC-8004 reputation on Monad (feedback count, summed value, and average).",
  {
    agentId: z.string().describe("ERC-8004 agent id (Identity NFT tokenId)"),
    clients: z
      .array(z.string())
      .min(1)
      .describe("trusted feedback-author addresses to aggregate (the registry requires at least one)"),
  },
  async ({ agentId, clients }) => {
    const [count, summaryValue, dec] = await publicClient.readContract({
      address: ADDRESSES.reputation,
      abi: reputationAbi,
      functionName: "getSummary",
      args: [BigInt(agentId), clients as `0x${string}`[], "", ""],
    });
    const c = Number(count);
    const sum = Number(summaryValue);
    const average = c > 0 ? sum / c : 0;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ agentId, count: c, summaryValue: sum, decimals: dec, average }, null, 2),
        },
      ],
    };
  }
);

/** GATE — ask AgentTrust PolicyVault whether a payment should proceed. */
server.tool(
  "gate_payment",
  "Ask AgentTrust's PolicyVault whether a payment to a payee agent should be ALLOWED, DENIED, or REQUIRE_VALIDATION — based on the payee's ERC-8004 reputation and the payer's policy.",
  {
    payer: z.string().describe("payer operator address"),
    payeeAgentId: z.string().describe("payee ERC-8004 agent id"),
    amountUsdc: z.number().describe("payment amount in USDC"),
  },
  async ({ payer, payeeAgentId, amountUsdc }) => {
    if (!ADDRESSES.policyVault) {
      return {
        content: [{ type: "text", text: "PolicyVault not deployed yet — set POLICY_VAULT_ADDRESS in .env." }],
        isError: true,
      };
    }
    const amount = BigInt(Math.floor(amountUsdc * 1_000_000));
    const [decision, reason] = await publicClient.readContract({
      address: ADDRESSES.policyVault as `0x${string}`,
      abi: policyVaultAbi,
      functionName: "gate",
      args: [payer as `0x${string}`, BigInt(payeeAgentId), amount],
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { decision: DECISIONS[Number(decision)] ?? "UNKNOWN", reason, payeeAgentId, amountUsdc },
            null,
            2
          ),
        },
      ],
    };
  }
);

/** WRITE — register an agent in the ERC-8004 Identity Registry. */
server.tool(
  "register_agent",
  "Register a new agent in the ERC-8004 Identity Registry on Monad; returns the registration tx hash.",
  { agentURI: z.string().describe("public URL of the agent registration JSON file") },
  async ({ agentURI }) => {
    const wallet = getWallet();
    const hash = await wallet.writeContract({
      address: ADDRESSES.identity,
      abi: identityAbi,
      functionName: "register",
      args: [agentURI],
    });
    return { content: [{ type: "text", text: `register tx: ${hash}` }] };
  }
);

/** WRITE — seed feedback for an agent (demo). */
server.tool(
  "seed_feedback",
  "Submit feedback for an agent to the ERC-8004 Reputation Registry (used to seed demo reputation).",
  {
    agentId: z.string(),
    value: z.number().describe("feedback value (positive = good, negative = bad)"),
    tag1: z.string().default("quality"),
    tag2: z.string().default(""),
  },
  async ({ agentId, value, tag1, tag2 }) => {
    const wallet = getWallet();
    const hash = await wallet.writeContract({
      address: ADDRESSES.reputation,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [BigInt(agentId), BigInt(value), 0, tag1, tag2, "", "", ZERO_HASH],
    });
    return { content: [{ type: "text", text: `giveFeedback tx: ${hash}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("agenttrust MCP server running on stdio");
