# AgentTrust — live "blocked → allowed" demo (Monad testnet)

Seeds real on-chain state on the **deployed** AgentTrust `PolicyVault` and reads
three live `gate(...)` decisions that prove the trust layer end-to-end:

| Agent              | Reputation seeded            | Gate decision        |
| ------------------ | ---------------------------- | -------------------- |
| GOOD               | 3× feedback value `+90`      | `ALLOW`              |
| SCAMMER            | 3× feedback value `-60`      | `DENY`               |
| UNKNOWN (id 999999)| none (never registered)      | `REQUIRE_VALIDATION` |

Everything runs against the canonical ERC-8004 registries and the deployed
PolicyVault — no mocks, no local chain.

## Network / contracts

- Chain: Monad testnet (`chainId 10143`, RPC `https://testnet-rpc.monad.xyz`)
- Explorer: https://testnet.monadexplorer.com
- PolicyVault: `0xaE8563CC15BF2519ae2793F7F2203389267632A6`
- ERC-8004 Identity: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ERC-8004 Reputation: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

## Run

```bash
pnpm install
pnpm tsx seed-demo.ts   # or: pnpm seed
```

The deployer/attestor key is loaded from the repo-root `.env` (`PRIVATE_KEY`).
The script waits for every receipt, logs all tx hashes, and writes
`seed-output.json` (agent ids, all tx hashes, and the three gate decisions).
At the end it asserts ALLOW / DENY / REQUIRE_VALIDATION and exits non-zero if any
decision is unexpected.

## How the gate works

`gate(payer, payeeAgentId, amount)` reads the **payee's** ERC-8004 reputation,
aggregated over the **payer's** trusted attestor set (`acceptedClients`), and
applies the payer's policy (`perTxCap`, `dailyCap`, `minReputation`,
`minFeedbackCount`, `requireValidation`). Decisions: `0 = ALLOW`, `1 = DENY`,
`2 = REQUIRE_VALIDATION`.

## Two facts learned about the live deployment (and how the script handles them)

1. **Self-feedback is rejected.** The deployed Reputation registry reverts with
   `Self-feedback not allowed` when the feedback author owns the rated agent.
   This is the correct trust model: a payer attests about a *counterparty*. So
   the demo registers the GOOD/SCAMMER agents under a fresh **ephemeral owner**
   wallet (funded 0.5 MON from the deployer), while the **deployer** remains the
   trusted feedback author / payer / `acceptedClient`.

2. **`getSummary` returns the AVERAGE, not the sum.** For 3× `+90` it returns
   `summaryValue = 90, count = 3`; PolicyVault then computes
   `effective = summaryValue / count`, giving GOOD an effective score of `30`
   and SCAMMER `-20`. The policy therefore sets `minReputation = 10`
   (`-20 < 10 ≤ 30`) so GOOD passes and SCAMMER fails on the live contract.

(Also handled: Monad executes optimistically, so a freshly funded account can
briefly return `Signer had insufficient balance`. The script waits for the
funded **finalized** balance and retries register on that transient error.)
