# AgentTrust on NEAR — research and migration plan

**Keep the UI and documentation design. Build native enforcement for spending, exact service permission and accepted capability evidence.** The current decision is to replace numeric reputation tiers with explicit owner-approved services and issuer-scoped credentials.

As of 11 November 2026. AgentTrust source pinned to [`21a3b111b7677d0b06ab1b063d647e4f52ea3b17`](https://github.com/agenttrust-labs/agenttrust/tree/21a3b111b7677d0b06ab1b063d647e4f52ea3b17). Research only: nothing was implemented, signed, funded, deployed, posted or submitted.

**Start with [09 — Exact gates and trust-list specification](09-feature-spec.md) and [10 — Competitive strategy and demo](10-competitive-strategy.md).** These answer the follow-up request and supersede the initial blanket recommendation to retain all five old gate concepts. The earlier reports supply technical evidence and architecture.

## Recommended build

Keep the existing website, docs shell, animation and visual structure. Implement one native Rust core contract containing policy, account-bound service identity/capability credentials, treasury reservations and receipts. The owner funds a testnet NEAR vault; an agent receives a narrowly scoped function-call key with one owner-selected purchase profile. Every agent payout passes mandatory on-chain checks. Track pending/success/failure explicitly and complete one real paid-API loop through a custom AgentTrust HTTP 402 adapter.

Keep unconditional pause/revocation, per-purchase and owner-wide daily caps. Change velocity to a fixed-window dispatch count. Add exact owner-approved services, block overrides and conditional capability checks against accepted issuers. No follower trust, synthetic risk score or automatic reputation promotion from payments. Unknown services deny by default; add exact one-off owner approval only with its complete safe execution path. Weekly budgets are deferred.

Native NEAR external payouts are the first milestone. A second NEP-141 asset is optional only after the complete native demo and failure evidence are ready. Intents, Chain Signatures and TEE attestation remain extensions. A shared vault's operator upgrade authority must be disclosed.

## Competitive choice

The 11 November directory snapshot contained 494 unique entries; six close projects were inspected statically at pinned revisions. Caps, approvals, MCP, receipts and even complete paid-agent report loops already overlap with peers. Do not pitch those as unprecedented.

The proposed demonstration shows an agent rejecting invalid supplier capability evidence, selecting an owner-approved qualified alternative, paying once and returning a useful invoice-CSV audit. A fresh purchase fails after required evidence is revoked or the approved identity/payout changes. Exact historical retries still return their prior state without paying twice. Make the identity/capability checks inspectable and scoped; seeded providers and project-operated validation are disclosed. This is a defensible product focus, not a guarantee of winning or proof of demand. See [the source comparison and demo plan](10-competitive-strategy.md).

## Findings that change implementation decisions

1. **NEAR calls are asynchronous independent receipts.** Policy checks, an external payout and later feedback cannot inherit Solana's all-or-nothing transaction rollback. Reserve funds/caps before dispatch; never refund or resend simply because a callback or HTTP request timed out. [Protocol implications](01-near-core.md).
2. **Function-call keys help but do not supply financial caps.** They restrict contract/method calls and gas allowance, cannot attach NEAR, and require a prefunded zero-deposit payment path. Contract session/amount/recipient checks remain essential. [Authority design](05-blueprint.md#authority-and-custody).
3. **AgentTrust has two different settlement paths.** The SDK constructs a strict gate + SPL transfer + feedback transaction; hosted `/settle` validates an existing transfer and emits separate feedback. Preserve the intended enforced gate, not an advisory-only path. [Pinned source tracing](02-agenttrust-source.md#3-there-are-two-materially-different-payment-paths).
4. **Quantu/ATOM is not portable NEAR reputation.** Use explicit native account registration, accepted issuer credentials, and separately labeled settlement history. Imported Agent Market scores require provenance, subject binding, freshness and oracle trust. [Source dependencies](02-agenttrust-source.md#4-identity-and-reputation-are-external-dependencies), [ecosystem](03-near-ecosystem-event.md).
5. **NEAR already has upstream x402 v2, but the vault is a different mechanism.** Standard `exact` uses one FullAccess-signed delegated `ft_transfer`. A restricted-key `execute_payment` route must be labeled a custom AgentTrust HTTP 402 adapter until a compatible mechanism is implemented and tested. [Interoperability analysis](03-near-ecosystem-event.md#follow-up-standard-near-x402-exists-but-a-vault-route-is-a-different-mechanism).
6. **The visual design is reusable; factual claims are not interchangeable.** Replace Solana IDs, six-decimal USDC formatting, one-atomic-transaction promises, proof badges and unsupported live integration claims. The docs assistant reads all 44 MDX pages, so the entire corpus needs migration. [UI/docs map](04-ui-and-docs-port.md).

The source review also found migration-relevant correctness concerns in authority bootstrap, counter consumption, reputation-subject binding, proof-field verification, asset accounting and feedback/dispute identifiers. These are static source findings, not reproduced exploits or claims about deployed bytecode. The report maps each to a concrete design/test requirement.

## Event fit

The requested [NEAR announcement](https://x.com/NEARProtocol/status/2112257967818997891) was read using x-recon, including its X Article body. Current [official rules](https://nearhackathon.com/HACKATHON.md) explicitly allow existing other-chain products: disclose reused work and identify the new NEAR contribution/diff. Testnet-only is eligible; Intents and Chain Signatures are optional. Best fit: AI Security & Defense; Agent Economy if the demo shows an agent buying a real service.

Deadline: **15 November 2026, 05:29 IST** / 14 November 23:59 UTC. Public repository and X demo links are required. No publication/submission action was taken. See [event findings](03-near-ecosystem-event.md#event-reuse-is-expressly-permitted).

## Read the study

| Document | Purpose |
|---|---|
| [00 — Scope and method](00-scope-and-method.md) | Exact request, X capture, source pin, methods and action boundary |
| [01 — NEAR core](01-near-core.md) | Accounts, keys, receipts, finality, gas/storage, native/FT settlement and recovery |
| [02 — AgentTrust source](02-agenttrust-source.md) | Contracts, policies, SDK, HTTP, challenges/replay, MCP, proofs and correctness concerns |
| [03 — Ecosystem and event](03-near-ecosystem-event.md) | Intents, MPC, TEE, Agent Market, identity/reputation, x402 and eligibility |
| [04 — UI and docs](04-ui-and-docs-port.md) | Exact reusable surfaces, content/data changes, decisions feed and docs migration |
| [05 — Blueprint](05-blueprint.md) | Architecture, interfaces, money/authority flow, states, keep/add/defer decisions, build order and verification matrix |
| [06 — Design review](06-review.md) | Second-pass model critique, invariants, limitations and remaining specification work |
| [07 — Existing lists and gates](07-existing-gates-and-lists.md) | Facilitators versus attestors, missing merchant lists, payer/payee scope and actual hook behavior |
| [08 — Product design review](08-gate-design-review.md) | Challenge to the initial five-gate assumption; approval and counter semantics |
| [09 — Current feature specification](09-feature-spec.md) | Exact keep/change/remove/add decisions, list authority, profile/credential binding, execution order and cut line |
| [10 — Competitive strategy](10-competitive-strategy.md) | Six close source comparisons, current field, useful demo, track fit and submission schedule |

## Verification status and next step

Completed: source/static analysis; current official docs/standards inspection; read-only network, package and public Market endpoint checks; X announcement extraction; gate/list specification; dated competition directory census and six repository comparisons; cross-report consistency review. The reference Git checkout remains unchanged.

Not completed: a NEAR implementation, contract tests, real payment, callback-failure exercise, restricted-key integration, token registration, UI interaction testing, x402 conformance or performance benchmark. Package availability and documented semantics are not execution evidence. The model critique is not an independent security audit.

The next implementation milestone, when building is requested, is the native vault/key boundary: one restricted-key allowed payment, cap denial, exact service/capability rejection, duplicate safety, pause/revoke, and safe transfer/callback accounting. The canonical scope is 09; do not reintroduce removed tier knobs from the old source merely to preserve five labels.
