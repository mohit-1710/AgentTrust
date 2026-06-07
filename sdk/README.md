# @agenttrust/sdk

In-repo TypeScript SDK for the **AgentTrust** pre-payment policy gate on **Monad testnet** (chainId `10143`). It wraps the ERC-8004 reputation registries, the deployed `PolicyVault`, and the x402 payment flow into a small, importable surface.

This package is private — it is consumed from within this repo and is not published to npm.

## What it does

Before an agent pays a counterparty, ask the on-chain `PolicyVault` whether the payment should proceed. The gate reads the payer's own self-sovereign policy and the payee's ERC-8004 reputation and returns one of:

- `ALLOW` — trusted, settle the payment.
- `DENY` — blocked before any funds move.
- `REQUIRE_VALIDATION` — not enough trust signal; hold for an explicit validation.

## Integrate in ~5 lines

```ts
import { createAgentTrustClient, gate } from "@agenttrust/sdk";

const clients = createAgentTrustClient(); // read-only public client
const { decision, reason } = await gate(payer, payeeAgentId, amount, clients); // amount in USDC atomic units (6dp)

if (decision === "ALLOW") await settlePayment();          // proceed (e.g. x402 settle)
else if (decision === "REQUIRE_VALIDATION") holdForValidation(reason);
else blockPayment(reason);                                 // DENY
```

## Read a payee's reputation

```ts
import { createAgentTrustClient, getReputation, trustVerdict } from "@agenttrust/sdk";

const clients = createAgentTrustClient();
// The ERC-8004 registry is Sybil-resistant: pass the attestor addresses YOU trust.
const rep = await getReputation(payeeAgentId, [myTrustedAttestor], clients);
const { verdict, label } = trustVerdict(rep); // TRUSTED | THIN_HISTORY | UNTRUSTED | NO_DATA
console.log(rep.average, rep.count, verdict, label);
```

## Writes (need a wallet)

Pass a private key to get a wallet client; the write helpers then work:

```ts
import {
  createAgentTrustClient,
  setPolicy, setKillSwitch, recordSpend,
  registerAgent, giveFeedback,
} from "@agenttrust/sdk";

const signer = createAgentTrustClient({ privateKey: process.env.PRIVATE_KEY as `0x${string}` });

await setPolicy({
  perTxCap: 100_000_000n,   // 100 USDC
  dailyCap: 500_000_000n,   // 500 USDC
  minReputation: 70n,
  minFeedbackCount: 1n,
  requireValidation: false,
  acceptedClients: [myTrustedAttestor],
}, signer);

await setKillSwitch(true, signer);      // emergency pause
await recordSpend(1_000_000n, signer);  // log spend into the 24h window
await registerAgent("https://example.com/agent.json", signer);
await giveFeedback(payeeAgentId, 100n, signer);
```

## Paying a gated x402 endpoint (client)

```ts
import { createPaymentClient } from "@agenttrust/sdk";

const { fetch: payFetch } = createPaymentClient({ privateKey });
const res = await payFetch(url, { headers: { "X-PAYEE-AGENT-ID": "1763" } });
// handles the 402 challenge, signs an EIP-3009 USDC authorization (exact scheme,
// eip155:10143), and retries — the resource server runs the gate before settling.
```

For the server side (verify → gate → settle), see `SERVER_FLOW_NOTE` and the reference implementation in `server/src/server.ts`.

## Deployed addresses (Monad testnet, chainId 10143)

Exported as `ADDRESSES`:

| Contract                 | Address |
| ------------------------ | ------- |
| PolicyVault              | `0x34b3bB1a99377128126201359749FE7614275E37` |
| ERC-8004 Identity        | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation      | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation      | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC (6 dp)              | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

x402 facilitator: `X402_FACILITATOR_URL` (`https://x402-facilitator.molandak.org`).

## Build

```bash
pnpm install
pnpm build        # tsc -> dist/
pnpm typecheck    # tsc --noEmit
```

## Example

`examples/gate-check.ts` reads the live gate for a deployer that has a policy and prints `ALLOW`:

```bash
pnpm exec tsx examples/gate-check.ts
```
