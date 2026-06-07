<div align="center">

# AgentTrust

### The non-custodial reputation + policy firewall for AI-agent payments on Monad.

*Every agent-to-agent USDC payment passes through one gate — `Allow`, `Deny`, or `RequireValidation` — **before** the money moves. No custody, ever.*

[![npm](https://img.shields.io/npm/v/@monad-agenttrust-sdk/sdk?color=4ec9b0&label=%40monad-agenttrust-sdk%2Fsdk&logo=npm)](https://www.npmjs.com/package/@monad-agenttrust-sdk/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Monad Testnet](https://img.shields.io/badge/Monad-Testnet%20%C2%B7%2010143-836EF9)](https://testnet.monadexplorer.com/address/0x34b3bB1a99377128126201359749FE7614275E37)
[![Foundry tests](https://img.shields.io/badge/Foundry-20%20tests%20passing-success?logo=ethereum)](contracts/test/PolicyVault.t.sol)
[![Built at Monad Blitz](https://img.shields.io/badge/Monad%20Blitz-Bangalore%20V4-200052)](#built-on-monad)

**[Site](https://monadagenttrustsite.vercel.app)** · **[Docs](https://monadagenttrustdocs-site.vercel.app)** · **[Dashboard](https://monadagenttrustweb.vercel.app)** · **[Contract](https://testnet.monadexplorer.com/address/0x34b3bB1a99377128126201359749FE7614275E37)**

</div>

---

## The problem

AI agents have started paying each other real money. On Monad, that settlement layer already exists: [**x402**](https://docs.monad.xyz/guides/x402-guide) turns an HTTP `402 Payment Required` into a signed USDC transfer, and [**ERC-8004**](https://docs.monad.xyz/guides/erc-8004) gives every agent an on-chain identity and reputation.

But there's a gap between *"agent wants to pay"* and *"USDC leaves the wallet"* — and right now, **nothing lives in that gap.** An autonomous agent will happily pay:

- a counterparty it has never transacted with,
- a counterparty with terrible on-chain reviews,
- ten times in a minute because a prompt told it to,
- an amount that drains its operator's budget for the day.

Agents don't get cold feet. They don't notice that the payee's reputation cratered yesterday. Whoever runs the agent is left hoping the model "behaves." Hope is not a spending control.

## What AgentTrust is

AgentTrust is the **policy firewall that sits in that gap.** It is a single on-chain function — `gate()` — that every payment must clear before it settles. On each call it reads the **payee's ERC-8004 reputation** and evaluates the **payer's own spending policy**, then returns one verdict:

| Verdict | Meaning |
| --- | --- |
| 🟢 `Allow` | Trusted and within policy → proceed to settle. |
| 🔴 `Deny` | Reputation too low or a policy limit breached → payment never moves, with a typed reason. |
| 🟡 `RequireValidation` | Unknown / borderline counterparty → escalate to ERC-8004 validation before paying. |

It is **non-custodial by design.** AgentTrust never holds, routes, or touches a single token. It only answers a yes/no/maybe question about a payment the payer is already trying to make — so adopting it is risk-free: the worst it can do is *stop* a payment.

---

## Architecture

```
                 ┌──────────────────────────────────────────────────┐
                 │                  AI AGENT (payer)                 │
                 │        wants a paid resource / API / service       │
                 └───────────────────────────┬──────────────────────┘
                                             │  1. GET resource
                                             ▼
                 ┌──────────────────────────────────────────────────┐
                 │             x402 RESOURCE SERVER                   │
                 │        verify → gate → settle  (Monad)            │
                 └───────────────────────────┬──────────────────────┘
                          402 Payment Required │  2. agent signs USDC payment
                                             ▼
        ┌────────────────────────────────────────────────────────────────┐
        │                  PolicyVault.gate(payer, payeeAgentId, amount)    │
        │                                                                  │
        │   reads ERC-8004 ───►  Identity · Reputation · Validation         │
        │   reads payer policy ─►  per-tx cap · daily cap · velocity        │
        │                          kill-switch · reputation threshold       │
        │                          (avg over trusted-attestor set)          │
        └───────┬──────────────────────┬───────────────────────┬──────────┘
                │                       │                       │
            🟢 ALLOW               🔴 DENY              🟡 REQUIRE_VALIDATION
                │                  (typed reason,        (escalate to ERC-8004
                ▼                   money never moves)     Validation Registry)
   ┌──────────────────────────┐
   │  molandak x402 facilitator│
   │  /verify  ▶  /settle      │  3. native USDC moves at Monad speed
   └──────────────────────────┘
```

The gate is a **single on-chain read** — cheap, deterministic, and impossible for the agent to talk its way around. The reputation threshold is averaged over a **payer-chosen set of trusted attestors**, so a Sybil flood of fake five-star reviews from throwaway accounts doesn't move the needle.

---

## Live on Monad testnet

| Resource | Address / URL |
| --- | --- |
| **PolicyVault** (the gate) | [`0x34b3bB1a99377128126201359749FE7614275E37`](https://testnet.monadexplorer.com/address/0x34b3bB1a99377128126201359749FE7614275E37) |
| ERC-8004 Identity Registry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.monadexplorer.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 Reputation Registry | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.monadexplorer.com/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| ERC-8004 Validation Registry | [`0x8004Cb1BF31DAf7788923b405b754f57acEB4272`](https://testnet.monadexplorer.com/address/0x8004Cb1BF31DAf7788923b405b754f57acEB4272) |
| USDC (Monad testnet) | [`0x534b2f3A21130d7a60830c2Df862319e593943A3`](https://testnet.monadexplorer.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) |
| x402 facilitator | `https://x402-facilitator.molandak.org` |
| npm package | [`@monad-agenttrust-sdk/sdk`](https://www.npmjs.com/package/@monad-agenttrust-sdk/sdk) |
| Marketing site · Docs · Dashboard | [site](https://monadagenttrustsite.vercel.app) · [docs](https://monadagenttrustdocs-site.vercel.app) · [dashboard](https://monadagenttrustweb.vercel.app) |
| Source | [github.com/mohit-1710/AgentTrust](https://github.com/mohit-1710/AgentTrust) |

> Chain ID `10143` (Monad testnet). The PolicyVault address above is the same gate the SDK, server, and dashboard all read from.

---

## The components

### 1. `PolicyVault` — the gate

A single Solidity contract exposing `gate(payer, payeeAgentId, amount) → (Decision, reason)`. In one call it enforces every control a payer might want:

- **Per-transaction cap** and **daily cap**
- **Sliding-window velocity** limit (rate of spend over time)
- **Multisig kill-switch** for an instant operator-wide freeze
- **Counterparty reputation threshold**, averaged over the payer's **trusted-attestor set** (Sybil-resistant)
- **Optional capability validation** via the ERC-8004 Validation Registry

Backed by **20 Foundry tests** covering each control and its boundary cases.

### 2. x402 server — `verify → gate → settle`

A resource server that wraps Monad's **molandak facilitator** and inserts the gate at exactly the right moment: it `verify`s the agent's signed payment, calls `PolicyVault.gate(...)`, and only on `Allow` does it `settle` native USDC. `Deny` and `RequireValidation` short-circuit before any value moves.

### 3. MCP server — `agenttrust`

A [Model Context Protocol](https://modelcontextprotocol.io) server so an AI agent can use the gate **live, from inside Claude Code.** Tools: `get_reputation`, `gate_payment`, `register_agent`, `seed_feedback`. The agent attempts a payment and is transparently allowed or blocked in front of you.

### 4. SDK — `@monad-agenttrust-sdk/sdk`

The gate in a few lines of TypeScript, built on [viem](https://viem.sh). No keys required to read a verdict.

```bash
npm i @monad-agenttrust-sdk/sdk
```

```ts
import { createAgentTrustClient, gate } from "@monad-agenttrust-sdk/sdk";

const at = createAgentTrustClient();                       // read-only, Monad testnet
const { decision, reason } = await gate(payerAddress, 1763n, 5_000_000n, at); // pay agent #1763, 5 USDC

if (decision === "ALLOW")             await settle();       // 🟢 proceed
else if (decision === "DENY")         throw new Error(reason); // 🔴 stop, with reason
else /* REQUIRE_VALIDATION */         await requestValidation(); // 🟡 escalate
```

---

## Live demo

Three agents seeded on-chain, three different verdicts — all real reputation reads against the deployed PolicyVault:

| Counterparty | ERC-8004 agent id | Verdict | Why |
| --- | --- | --- | --- |
| Reputable agent | **1763** | 🟢 `ALLOW` | reputation clears the payer's threshold |
| Scammer agent | **1764** | 🔴 `DENY` | *"reputation below threshold"* — payment never moves |
| Unknown agent | *(no history)* | 🟡 `REQUIRE_VALIDATION` | no track record → escalate before paying |

Run the on-chain seeder in [`demo/`](demo/) to reproduce the exact state, then watch the agent get blocked from paying `1764` and cleared to pay `1763`.

---

## Quickstart

```bash
# 1. clone
git clone https://github.com/mohit-1710/AgentTrust.git
cd AgentTrust

# 2. install the monorepo (pnpm workspaces)
pnpm install

# 3. run the contract suite (Monad Foundry)
cd contracts && forge test        # 20 passing
cd ..

# 4. configure
cp .env.example .env              # RPC, private key, contract addresses
```

Run the pieces you need:

```bash
pnpm --filter server dev          # x402 verify → gate → settle
pnpm --filter mcp dev             # MCP server for Claude Code
pnpm --filter web dev             # Next.js dashboard
```

**Deploy notes.** Contracts deploy to Monad testnet with Foundry (`forge script ... --rpc-url <monad-testnet> --broadcast`); the web/site/docs apps deploy on Vercel. The PolicyVault is already live at the address above — point the SDK at it and you can read verdicts immediately, no deployment required.

---

## Repository structure

```
AgentTrust/
├── contracts/    # PolicyVault.sol + the gate's 20 Foundry tests
├── sdk/          # @monad-agenttrust-sdk/sdk — viem client, gate(), reputation reads
├── mcp/          # MCP server "agenttrust" — the live agent surface
├── server/       # x402 resource server: verify → gate → settle (molandak facilitator)
├── web/          # Next.js dashboard — gate decisions, reputation, on-chain links
├── site/         # marketing site
├── docs-site/    # documentation site
└── demo/         # on-chain seeder for the 1763 / 1764 demo state
```

---

## Built on Monad

AgentTrust is composed entirely from Monad-native primitives:

- **[ERC-8004](https://docs.monad.xyz/guides/erc-8004)** — the gate reads all three canonical registries (Identity, Reputation, Validation) directly.
- **[x402](https://docs.monad.xyz/guides/x402-guide)** — agentic payments, settled through Monad's free molandak facilitator.
- **Native USDC** — real value moving on Monad testnet.
- **Monad Foundry** — Solidity contracts and the full test suite.
- **viem 2.x · Next.js · TypeScript** — across the SDK, server, MCP, and apps.

Built at **Monad Blitz Bangalore V4 — "The Agent Economy."**

## Team — Atomic

- **Mohit Kumar**
- **Rajveer Bishnoi**

## License

[MIT](#license) © Team Atomic.
