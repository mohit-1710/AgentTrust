# AgentTrust x402 Payment Server

A non-custodial **pre-payment policy gate** for AI-agent payments on **Monad testnet**.

It sits inside the x402 `verify → settle` path: when an AI agent tries to pay for
a protected resource, this server runs AgentTrust's **PolicyVault gate** and only
settles the USDC payment if the gate returns **ALLOW**.

## Flow

```
agent ──GET /protected/report────────────────────────────► server
        (no X-PAYMENT)
server ──402 + PaymentRequirements (exact, eip155:10143, USDC)──► agent

agent  ──GET /protected/report (X-PAYMENT: signed EIP-3009 auth)─► server
server ─1─ decode X-PAYMENT  -> PaymentPayload
server ─2─ PolicyVault.gate(payer, payeeAgentId, amount)  (viem read on Monad)
            ├─ DENY               -> 403 { decision, reason }     (NO settle)
            ├─ REQUIRE_VALIDATION -> 402 { decision, reason }     (NO settle)
            └─ ALLOW ─3─ facilitator.verify(payload, requirements)
                       ─4─ facilitator.settle(payload, requirements)
                          -> 200 resource + tx hash + X-PAYMENT-RESPONSE
```

The settlement itself is performed by the **molandak x402 facilitator**
(`https://x402-facilitator.molandak.org`), which broadcasts the EIP-3009
`transferWithAuthorization`. This server never custodies funds — it only gates.

## Requirements

- Node 25 / pnpm
- A Monad-testnet wallet (for the server's `payTo` recipient, and for the client demo)

## Env

Loaded via `dotenv` from the **repo root `.env`** (one level up), then a local
`server/.env` if present. Relevant vars:

| Var | Purpose | Notes |
|---|---|---|
| `MONAD_TESTNET_RPC` | RPC URL | default `https://testnet-rpc.monad.xyz` |
| `MONAD_TESTNET_CHAIN_ID` | chain id | `10143` → x402 network `eip155:10143` |
| `USDC_TESTNET` | USDC token | `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6 dp) |
| `X402_FACILITATOR` | facilitator base URL | `https://x402-facilitator.molandak.org` |
| `POLICY_VAULT_ADDRESS` | AgentTrust gate | **MAY be empty** → gate is stubbed to ALLOW |
| `REPUTATION_REGISTRY` | ERC-8004 reputation | optional, read-only enrichment |
| `PRIVATE_KEY` | server wallet | used to derive default `payTo` |
| `PAY_TO` | override recipient | optional |
| `CLIENT_PRIVATE_KEY` | paying agent (client demo) | falls back to `PRIVATE_KEY` |
| `PORT` | server port | default `4021` |
| `PRICE_ATOMIC` | resource price | default `10000` = 0.01 USDC |

## Run

```bash
pnpm install
pnpm typecheck          # tsc --noEmit (passes)

pnpm start              # start the server (PORT defaults to 4021)
# in another shell:
pnpm client             # @x402/fetch demo against the server
```

Quick checks:

```bash
curl -s localhost:4021/health
curl -i localhost:4021/protected/report      # -> 402 + PaymentRequirements
```

### Client demo

`src/client.ts` uses `@x402/fetch` `wrapFetchWithPayment` with an EVM `exact`
scheme. Set `CLIENT_PRIVATE_KEY` to a Monad-testnet wallet **funded with USDC**
to reach a real settlement. Without USDC the request still exercises
decode → gate → verify (the facilitator will then report insufficient/invalid
payment), which is enough to demo the gate.

Pass `X-PAYEE-AGENT-ID` (header) or `?payeeAgentId=` (query) to choose which
agent is being paid; this is the `payeeAgentId` argument to `PolicyVault.gate`.
The `payer` is taken from the signed EIP-3009 `authorization.from` (overridable
with the `X-PAYER` header for testing).

## Verified facts

- USDC EIP-712 domain read **on-chain**: `name = "USDC"`, `version = "2"`,
  `decimals = 6`. The `extra: { name, version }` in PaymentRequirements matches.
- Facilitator `/supported` (observed live) advertises `exact` and `upto` on
  `eip155:10143` and `eip155:143`, x402Version 2. We use **exact**.
- Facilitator signer for `eip155:10143`:
  `0x7f6a2850669202519f0FE8aa912451238820Db86`.
- `verify` returns `{ isValid, invalidReason?, invalidMessage?, payer?, ... }`.
- `settle` returns `{ success, errorReason?, errorMessage?, payer?, transaction, network, amount?, ... }`.
  Code branches on `isValid` / `success` and surfaces the `*Reason`/`*Message`
  fields verbatim — no guessed key names.

## Implementation notes

- Remote facilitator calls use `HTTPFacilitatorClient` from `@x402/core/http`
  (implements `verify` / `settle` over HTTP against `X402_FACILITATOR`).
- X-PAYMENT decode / X-PAYMENT-REQUIRED + X-PAYMENT-RESPONSE encode use the
  `@x402/core/http` codec helpers.
- The gate read uses `viem` `readContract` against the
  `gate(address,uint256,uint256) view returns (uint8,string)` ABI.

## UNVERIFIED / blocked

- **PolicyVault not deployed yet** (`POLICY_VAULT_ADDRESS` empty). The gate is
  **stubbed to ALLOW** with a clear warning. The real `gate()` decision values
  (0=ALLOW, 1=DENY, 2=REQUIRE_VALIDATION) and the ABI come from the spec and have
  not been exercised against a live contract.
- **End-to-end settlement** has not been run with a funded wallet, so a real
  Monad tx hash was not produced in this build. The 402 path, gate stub, decode,
  typecheck, and server boot are all verified.
- The exact wire shapes the molandak facilitator returns from `/verify` and
  `/settle` (beyond the `@x402/core` typed contract) were not exercised live;
  the code reads only the typed fields above and treats anything else as opaque.
