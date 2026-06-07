# AgentTrust — Web Dashboard

The consumer-facing dashboard for **AgentTrust**, a non-custodial pre-payment
policy gate for AI-agent payments on **Monad**. It visualizes, live, an AI
agent's payment being **blocked** when the payee has poor on-chain ERC-8004
reputation, then **allowed** for a trusted payee — settling USDC at Monad speed.

Built for **Monad Blitz Bangalore V4 — "The Agent Economy."**

## What it does

- **On-chain Reputation panel** — enter an ERC-8004 `agentId` + a list of
  trusted attestor addresses and read `getSummary` directly from the LIVE
  Reputation Registry on Monad testnet (`0x8004B663…388713`). Renders
  count / total / average + a consumer-friendly trust verdict. _This is a real
  on-chain read — no mocks._
- **Policy Gate** — given payer / payee agentId / amount, returns
  **ALLOW / DENY / REQUIRE_VALIDATION** with the reason, as a clear color-coded
  verdict. If `PolicyVault` is deployed (env), it calls `gate()` on-chain;
  otherwise it computes a **preview** decision client-side from the live
  reputation read + a sample policy, mirroring `PolicyVault.gate()` exactly.
- **Live demo flow** — a guided two-step walkthrough (scammer → blocked,
  trusted → allowed) for a live stage demo, with Monadscan links.

## Stack

Next.js (App Router, TS) · Tailwind + shadcn-style UI · viem + wagmi
(custom Monad testnet chain) · TanStack Query.

## Run

```bash
pnpm install
cp .env.example .env.local   # optional; sensible defaults are baked in
pnpm dev                     # http://localhost:3000
```

Other scripts:

```bash
pnpm build       # production build
pnpm typecheck   # tsc --noEmit
pnpm rep:check   # live smoke test against the Reputation Registry on testnet
```

`pnpm rep:check` should print real data, e.g.:

```
agentId=1 clients=1  =>  count=1 sum=90 decimals=0 avg=90  [trusted attestor]
agentId=1 clients=1  =>  count=0 sum=0 decimals=0 avg=null [untrusted attestor]
LIVE READ OK — registry 0x8004B663056A597Dffe9eCcC1965A193B7388713
```

## Environment

| Var | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_MONAD_RPC` | `https://testnet-rpc.monad.xyz` | Monad testnet RPC |
| `NEXT_PUBLIC_POLICY_VAULT_ADDRESS` | _(empty)_ | When set, the gate calls `PolicyVault.gate()` on-chain. When empty, the gate runs in **preview mode** off the live reputation read. |

## Known testnet facts (verified on-chain)

- Monad testnet — chainId **10143**, RPC `https://testnet-rpc.monad.xyz`,
  explorer `https://testnet.monadexplorer.com`.
- ERC-8004 Reputation Registry `0x8004B663056A597Dffe9eCcC1965A193B7388713`
  (`getSummary` requires a non-empty clients array; `summaryValue` is a SUM —
  the UI shows the average).
- USDC testnet `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6dp).
- Demo data: **agentId 1**, rated by trusted attestor
  `0xb6E8B2692cdc3A31280DCa8E9C8b88bb5e436f24` → count 1, sum 90, avg 90.

## Demo script (stage)

1. **Reputation** — read agent 1 with the trusted attestor → TRUSTED, avg 90.
   Swap the attestor for one you don't trust → no data.
2. **Demo flow** — hit **Run full walkthrough**. Step 1 (untrusted) blocks with
   REQUIRE VALIDATION; step 2 (trusted) returns ALLOW. Same agent, same amount —
   the only difference is whose ratings you trust.
