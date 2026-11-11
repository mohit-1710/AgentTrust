# Existing gates, lists, and hook semantics

Static inspection, 10 November 2026. Source pin: `21a3b111b7677d0b06ab1b063d647e4f52ea3b17`. No product code, tests, transactions, or external writes were executed. This note resolves the user's reference to a list of “trusted followers or something” and supplies concrete source facts for the NEAR feature specification.

## What the remembered list could be

No social follower graph, follow/unfollow API, or follower-count payment policy was found in the inspected `programs`, SDK/server, MCP, or documentation source. That is a bounded source finding, not a claim about every private branch or future product concept.

Three existing lists are easy to confuse:

| Existing object | What it actually does | What it does not prove |
|---|---|---|
| `agenttrust_list_facilitators` | MCP returns a static adapter manifest: Pay.sh live; Dexter in-flight; atxp and MCPay roadmap | It is not a user-owned trusted-counterparty list, reputation ranking, or live discovery/health query |
| `accepted_attestors` | Per-policy issuer allowlist used to decide whose capability credentials count | It does not list merchants the owner approves paying, or establish that a listed issuer is independently honest |
| Pre-warmed counterparty map | Hosted production resolver maps a bounded set of demo agents to Quantu/ATOM accounts | Inclusion is an operational resolution requirement, not a payer's trust approval or universal reputation directory |

Evidence: [static MCP manifest](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/mcp/src/tools/read/list-facilitators.ts#L1-L76), [attestor acceptance](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/require_validation.rs#L94-L104), [hosted map/resolver](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/production.ts#L66-L143).

The term **facilitator** means the payment-integration/processing component (Pay.sh etc.), rather than an agent's social follower. If that is the list the user remembers, keep it as supported integration metadata with truthful status. Do not turn it into a social trust mechanism.

## Two advertised lists are not implemented as owner policy

The landing copy says allowlists participate in payment checks. But the five-kind `PolicyAccount` contains no merchant allowlist or blocklist. The gate handler also explicitly states that a **facilitator allowlist is future v1.1 work** and currently permits any signer to call its counter-mutating gate. An API registry of registered adapters is not that missing on-chain caller authorization.

Evidence: [marketing wording](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/data/storytelling.ts#L15-L21), [actual policy fields](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/state/policy_account.rs#L11-L35), [future facilitator allowlist comment](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/gate_payment.rs#L36-L44).

**NEAR recommendation:** add an actual owner-controlled approved-service list and explicit block overrides if they are part of the product promise. Authenticate spending through the enrolled restricted key/session. Keep adapter selection separate. An approved service must never bypass amount, pause, asset, invoice, session, or replay checks.

## Exact existing gate configuration

The pure composer runs enabled policies in this order: KillSwitch → Spending → Velocity → CounterpartyTier → RequireValidation. A bitmask can disable every policy, including the kill switch. State deltas are applied only when all enabled gates return Allow.

| Existing gate | Configured inputs | Important behavior |
|---|---|---|
| KillSwitch | Per-agent paused flag; members and threshold authorize pause/unpause | Composer can skip it through bitmask; only per-agent scope implemented in current handlers |
| Spending | Per-transfer, UTC-day, Monday-week raw-amount caps | All same raw u64 namespace; `_mint` ignored by gate; no per-token separation |
| Velocity | Window seconds, amount cap, tier0 decay field; payer tier | Fixed reset window using Solana slots; does not count request number; tier0-decay field has no effect in current evaluator |
| CounterpartyTier | Immediate/confirmed mode; minimum tier; optional max risk and min confidence; unrated treatment | Composer passes **payee** ATOM view. `255` disables risk constraint; `0` disables min confidence; unknown resolves to allow, deny, or require validation |
| RequireValidation | Required capability hash; up to two accepted issuer keys | Checks **payee** subject, capability, expiry and revocation. Zero capability means pass-through. Empty accepted-issuer slots mean any attestor accepted |

Evidence: [composer](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/composer.rs#L110-L194), [configuration schema](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/init_policy.rs#L32-L69), [tier choices/thresholds](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/counterparty_tier.rs#L79-L111), [validation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/require_validation.rs#L56-L104).

`gate_mode` Immediate/Confirmed refers to two ATOM tier bytes, not NEAR transaction finality. `scope_kind` accepts Global, PerCollection, PerAgent and stores that value, but the actual gate accounts derive a hardcoded per-agent kill switch and composer does not select global/collection policy by that field. Exposing the three options would overstate implemented scope. [Constants](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/constants.rs#L17-L37), [scope validation/storage](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/init_policy.rs#L75-L86), [hardcoded kill-switch scope](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/gate_payment.rs#L26-L68).

Policy settings are init-only at this revision; no policy-update instruction appears in the exported program. The MCP comments also explicitly say policies are immutable after init. [Program surface](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/lib.rs#L43-L127), [MCP default explanation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/mcp/src/tools/write/init-policy.ts#L34-L42). A useful NEAR product needs owner-controlled versioned changes that preserve pending liabilities, rather than reproducing this limitation.

## Payer versus payee: distinguish buyer protection from seller admission

The on-chain composer treats parties differently:

- **Payer tier** feeds velocity throttling (`payer_atom`, lines 129–142).
- **Payee tier/risk/confidence** feeds the CounterpartyTier gate (lines 145–148).
- **Payee capability** feeds RequireValidation (lines 169–176).

That is a buyer-side spending protection path: an agent pays a suitable recipient.

However, the Pay.sh demo's `decide` replacement checks `ctx.payerAgent` against its tier table, and its live-tier factory likewise resolves the **payer's** ATOM account. The file explicitly says it substitutes for an on-chain `gate_payment` simulation. It demonstrates seller-side buyer admission, not the complete buyer-vault policy pipeline. [Demo static rule](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/examples/pay-sh-demo/src/policy.ts#L1-L67), [live payer lookup](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/examples/pay-sh-demo/src/policy.ts#L137-L178).

**NEAR recommendation:** define the first product clearly as owner/buyer spending protection. Trust-list, capability and imported reputation gates evaluate the recipient/service, with account/payout binding. Seller-side customer reputation screening is a separate optional feature, not a mandatory extra gate on every purchase. A first-time payer who can pay the invoice is not automatically unsafe. Do not port the demo's payer-tier lookup as the core merchant-safety test.

## What “the hook” should mean

In source, there are three distinct mechanisms:

1. `mountTrustGate` is an Express integration wrapper. It installs read-only `/verify` and `/receipt`; it does not intercept every wallet spend or enforce the actual transfer. [SDK wrapper](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/express.ts#L1-L20), [mounted routes](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/express.ts#L83-L110).
2. `mountFacilitatorRoutes` adds HTTP `/verify`, `/settle`, `/receipt`, `/dispute` around selected adapters. Its registry dispatches by a configured adapter name/header; selection does not confer buyer spending authority. [Routes](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/index.ts#L96-L124), [adapter resolution](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/facilitators/registry.ts#L129-L147).
3. Token-2022 `TransferHook` is a Solana token extension used in the atomicity discussion. It is not AgentTrust's social-trust feature or a native NEAR token mechanism. [Atomicity doc](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/docs-site/content/docs/verification/atomic-tx-invariant.mdx#L15-L23).

For NEAR, define the authoritative “hook” as the vault's **on-chain payment-admission method**. An SDK preview can explain it, but every worker-authorized payout must pass that method's mandatory guards and configured counterparty rules.

## Product consequences: recommended priorities

These are recommendations, not facts about the existing code:

- **Always-on integrity checks:** session authorization/expiry/revocation, emergency pause, permitted network/asset, invoice signature and exact tuple binding, replay/idempotency, sufficient available balance and reservations, valid payout identity. Users cannot disable these with a bitmask.
- **Core configurable spending rules:** per-purchase and daily caps, recipient approval policy, and a short-window burst rule. A weekly cap is useful but not necessary to demonstrate the wedge; keep the interface simple rather than exposing every original field.
- **Actual owner trust list:** exact registered service/payout, owner, permission scope, expiry and revoked state. A block override wins. Approval does not waive budget or integrity checks. Do not import a social follower count or enable transitive “trusted by someone I follow” spending.
- **Accepted attestors:** a separate issuer list, used only when a route requires a capability/credential. Empty issuer list must not silently mean anyone may approve. “No capability required” should be an explicit different setting.
- **Unknown service policy:** explicit deny by default, or return an owner-review/approval result. A tightly bounded trial budget is a later deliberate mode, not implicit trust from missing data. Owner approval is not evidence of capability if that capability is independently required.
- **Defer numeric reputation gates:** no native replacement source currently establishes Quantu-equivalent tier/risk/confidence. Import scores later with explicit provider/subject/freshness. Do not synthesize risk from follower count or self-paid testnet transactions.
- **Do not preserve unsupported knobs:** Solana Immediate/Confirmed ATOM modes, unused scope modes, tier decay, globally permissive attestor default, and old counters ignoring token identity.

One additional source edge case to avoid: when CounterpartyTier returns Unrated and policy says RequireValidation, composer returns `RequireValidation` immediately before evaluating a supplied capability attestation. A valid credential does not resolve that branch in this function. Model list approval, missing evidence, and capability validation as explicit composable conditions, so the owner/agent has a real path out of a needs-validation result. [Early-return branch](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/composer.rs#L145-L185).

The main feature specification should decide these policies in one place and supersede the earlier blanket recommendation to retain all five original gate implementations unchanged. The source provides design inputs; it does not determine which knobs deserve v1.
