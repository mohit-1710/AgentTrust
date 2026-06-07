# AgentTrust

**The non-custodial reputation firewall for AI-agent payments on Monad.**

AI agents are starting to pay each other real money over [x402](https://docs.monad.xyz/guides/x402-guide) on Monad. Identity and reputation exist on-chain via [ERC-8004](https://docs.monad.xyz/guides/erc-8004) — but nothing checks *who an agent is about to pay before the money moves*. AgentTrust is that check: an inline gate that reads the payee's on-chain ERC-8004 reputation and enforces the payer's spending policy, then **allows or blocks** each payment — without ever taking custody of funds.

> Built at **Monad Blitz Bangalore V4 — "The Agent Economy."**

---

## What it does

Before any x402 USDC payment settles, AgentTrust's `PolicyVault` returns **Allow / Deny / RequireValidation** based on:

- **Payee trust (counterparty side):** the payee's on-chain **ERC-8004 reputation** (and capability validation) must clear a threshold.
- **Payer policy (your agent's side):** per-transaction / daily caps, sliding-window **velocity** limits, and a **kill-switch** for emergency pause.

If it says Allow, settlement proceeds through the Monad x402 facilitator. If it says Deny, the agent gets a typed reason it can act on — and the money never leaves.

## How it works

```
AI agent ──(x402 request)──▶ resource server ──402──▶ agent signs payment
                                   │
                                   ▼
                         AgentTrust gate  ──reads──▶ ERC-8004 Reputation Registry (Monad)
                         (PolicyVault.sol)            + payer policy (caps/velocity/killswitch)
                                   │
                  Allow ◀──────────┴──────────▶ Deny (typed reason)
                    │
                    ▼
        Monad x402 facilitator  ──/verify ▶ /settle──▶ USDC moves on Monad
```

A **Model Context Protocol (MCP)** server exposes the gate to AI agents directly, so an agent inside Claude Code can attempt a payment and be transparently blocked from paying a low-reputation counterparty, then allowed to pay a trusted one — live.

## Built on Monad

- **Chain:** Monad Testnet
- **Standards:** ERC-8004 (Trustless Agents — Identity + Reputation registries) · x402 (agentic payments, free Monad facilitator)
- **Contracts:** Solidity, deployed with **Monad Foundry**
- **App / MCP:** TypeScript + **viem 2.40+**, Next.js dashboard
- **Token:** native USDC on Monad

### Deployed (Monad testnet · chainId 10143)

| Contract | Address |
|---|---|
| **PolicyVault** | [`0x34b3bB1a99377128126201359749FE7614275E37`](https://testnet.monadexplorer.com/address/0x34b3bB1a99377128126201359749FE7614275E37) |
| ERC-8004 Reputation (read) | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation (read) | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC (testnet) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

## Repo structure

```
contracts/   # PolicyVault.sol + (optional) ERC-8004 Validation Registry — Monad Foundry
server/      # x402 facilitator wrapper: verify → gate → settle
mcp/         # MCP server (viem) — the live agent demo surface
web/         # Next.js dashboard (gate decisions, reputation, on-chain links)
```

## Setup

```bash
pnpm install
cp .env.example .env   # fill RPC, private key, contract addresses
```

## Run

```bash
# contracts
cd contracts && forge build && forge test

# app + server
pnpm dev
```

Deploy targets: web on Vercel, server/MCP on Fly.io, contracts on Monad Testnet.

## Demo

Watch an AI agent get **blocked** from paying a low-reputation "scammer" agent, then **clear** a payment to a reputable one — reputation-checked in real time, settling at Monad speed.

## Team — Atomic

- Mohit Kumar
- Rajveer Bishnoi

## License

MIT
