# Second-pass architecture review

Date: 2026-11-10. This is a model-based consistency and failure-mode review, not an independent security audit or empirical validation. No application, contract, sandbox, database, deployment, signing or payment operation was run.

Review scope: the coordinator's proposed architecture and completed `05-blueprint.md`, `01-near-core.md`, the pinned AgentTrust source analysis in `02-agenttrust-source.md`, the ecosystem/interoperability findings in `03-near-ecosystem-event.md`, and UI/docs migration requirements. The completed blueprint was read end to end and cross-checked against the failure-mode requirements below.

## Assessment

The proposed direction is technically coherent: retain the existing visual design; put policy, owner/session authority, local agent/credential state and receipts in one Rust contract; start with pre-funded native NEAR payouts; use a narrowly restricted direct-call agent key; treat settlement as asynchronous; and defer FT/Intents/MPC/TEE complexity until the native failure paths work.

This addresses the largest mismatch with the original Solana implementation: independent NEAR receipts cannot reproduce the original SDK's gate + SPL transfer + feedback rollback bundle. A shared native vault can enforce authorization and reserve budgets before an outgoing transfer, while accurately presenting later success/failure/uncertainty. It must disclose shared-vault custody and upgrade authority. Keeping the UI design does not justify retaining Solana facts or old proof claims.

## Material requirements for the implementation specification

These should be explicit acceptance criteria, not assumed consequences of using Rust or a restricted key.

| Requirement | Failure it prevents | Concrete check |
|---|---|---|
| Every payment ID stores an immutable payload hash; repeat ID must match all fields | A retry mutates recipient, amount or resource while reusing a receipt | Same ID/same request returns existing state; same ID/different request rejects |
| Authenticate owner, enrolled public key, policy, expiry and direct-call context | One account's worker uses another owner's deposit/policy; relayer key mistaken for buyer | Wrong owner/key/policy and third-party delegated call reject before mutation |
| Vault session revocation and NEAR access-key deletion are distinct controls | UI says revoked while contract session still authorizes another path, or owner assumes dispatched work canceled | Each future-call revocation path tested; dispatched payment remains pending/terminal |
| Reserve both balance and policy allowance before transfer | Concurrent calls each observe the same available cap | Sum of settled and pending commitments cannot exceed the configured limit |
| Store original time buckets and policy version | Delayed failure subtracts from a fresh day/week; edit resets active liabilities | Callback after rollover/update only changes its recorded reservation |
| Failed-transfer refund liquidity tracked separately from owner claim | Application recredits funds before NEAR refund arrives and spends another tenant's liquidity | Current liquid balance excluding storage/operating/outgoing/uncertain liabilities gates withdrawals and dispatch |
| Callback private, bounded and idempotent; no payout from callback | Forged finalization, double credit, recursive second transfer | External or repeated callback cannot alter an already finalized operation |
| Unknown outcomes stay reserved | Timeout or callback failure causes a duplicate payout/refund after actual success | Retry polls original operation; no timer releases or redispatches it |
| Per-owner liabilities, storage charges and withdrawal rules | Shared-vault tenants subsidize storage attacks or withdraw reserved funds | Owner can withdraw only its spendable claim; reserved/storage funds remain unavailable |
| Canonical payout identity bound to capability/reputation subject | A good agent's credentials authorize payment to an unrelated recipient | Registry payout binding or explicit approved-recipient mapping checked inside spend method |
| Native NEAR units presented honestly | Existing dollar labels imply a USD-stable spending promise | Cap inputs/receipt units show NEAR; fiat display is optional informational conversion only |
| Payment history separate from service-quality reputation | Successful cheap/self payments manufacture perceived capability or good work | UI/docs identify history source, seeded records and accepted attestor claims |

The core NEAR report already documents bucket accounting, private callbacks, uncertain outcomes, refund-in-flight liquidity, custody, exact finality, and storage. These are reasons to keep the direction, not unresolved contradictions in that report.

## Recovery is a bounded limitation, not just a retry loop

A transfer can succeed while the callback fails. An off-chain watcher can inspect the original finalized receipt chain, but the contract cannot simply read and trust a backend RPC response. Therefore a no-oracle MVP may leave an operation locked for reconciliation. That is an acceptable explicitly stated liveness limitation for a testnet demonstration; it is not complete production recovery.

If an operator can resolve uncertain records, document exactly which states it may finalize and how its assertion is tied to the original operation and evidence. Do not disguise an operator assertion as a trustless receipt proof. Resolution must never issue the original payout again.

Official support: [callback failure semantics](https://docs.near.org/smart-contracts/security/cross-contract-calls/callback-failures), [balance deduction before an external call](https://docs.near.org/smart-contracts/security/cross-contract-calls/reentrancy), [refund behavior](https://docs.near.org/smart-contracts/security/cross-contract-calls/refunds). These establish protocol behavior; the proposed recovery policy is a design inference.

## Authorization and interoperability boundary

The proposed ordinary function-call key can call `execute_payment` with zero attached deposit and has no permission to transfer directly, manage the owner's keys or upgrade the vault. The contract still enforces amount, payout and policy: key gas allowance is not an asset cap. Use an explicit method allowlist, bounded gas allowance and session expiry, and keep owner funding/withdrawal/policy/session management on authenticated owner methods.

The direct-call requirement is deliberate. Current primary runtime documentation states that NEP-366 inner actions have the user's account as predecessor while signer remains the relayer. Consequently a registered `signer_account_pk` cannot be interpreted as the original worker key on that path. Requiring predecessor==signer and the enrolled key excludes ordinary third-party relaying until a separately authenticated path exists. Sources: [NEP-366](https://github.com/near/NEPs/blob/master/neps/nep-0366.md), [nearcore actions](https://near.github.io/nearcore/RuntimeSpec/Actions.html), [access keys](https://docs.near.org/protocol/accounts-contracts/access-keys).

The upstream native-NEAR x402 `exact` mechanism is already available, but its single FullAccess-signed delegated `ft_transfer` is a different authorization model from the proposed contract vault route. The first native-NEAR HTTP 402 adapter should explicitly describe its AgentTrust-specific payment payload and matching client. It must not claim conformance to upstream `exact` until that precise mechanism is implemented and conformance-tested. HTTP 402 headers alone establish no standard scheme compatibility. This is a bounded compatibility distinction, not a claim that NEAR lacks x402.

## Preservation and regressions versus AgentTrust

- Keep the UI hierarchy, typography, motion, route structure, explanatory docs and typed decisions. The later [feature specification](09-feature-spec.md) adds exact approval only if its full flow is implemented.
- The initial recommendation to preserve five policy concepts is superseded by [09](09-feature-spec.md): explicit service permission replaces numeric tier gating; weekly budgets are deferred; velocity becomes owner-wide dispatch count. Solana slot arithmetic, raw-u64 multi-asset ambiguity and unsupported ATOM dependence remain removed.
- A single native contract can still display policy, identity/credentials and feedback as conceptual modules; change any copy saying three deployed programs/contracts.
- Replace one-atomic-transaction promises with policy-enforced dispatch and inspectable settlement receipts. A payment may be one user submission yet involve multiple receipts.
- Remove inherited 7/7 Kani and 662 sub-check badges until exact new verification results exist. Unit tests or a mirrored predicate cannot establish NEAR callback atomicity.
- Existing HTTP dispute endpoint is a 501 stub in the pinned source, and on-chain feedback/dispute records collide by payment hash. Do not treat preserving that API as necessary first-demo parity. If later added, disputes are feedback records unless an actual escrow/adjudication feature is built.
- Keep hosted MCP read-only. Add a complete constrained local payment workflow or SDK agent example; inspection/configuration tools alone do not demonstrate agent commerce.
- Preserve the MIT notice and make reused source/baseline versus new NEAR work visible in the README and linked diff, as the event rules require.

## Demo and deadline scope

With the November 14 23:59 UTC deadline (November 15 05:29 IST), the credible first milestone is one paid-service loop with a real testnet NEAR transfer and receipt, plus cap-denial, pause, credential rejection and duplicate-request handling. It should show that denied authorization sends no payout and does not consume spending counters. An autonomous script/local tool should make the payment; clicking a dashboard alone underserves the agent use case.

The allowed path must include receipt finalization and successful service access; the denial path must show an unchanged payee balance/absence of transfer through authoritative outcomes. At least one failed-transfer and one callback-failure scenario are needed before claiming recovery semantics. Under the standing database restriction, sandbox execution itself requires a valid exception; this research ran no sandbox and cannot certify those behaviors.

Do not let copying every legacy workspace, 21 tools, all facilitator adapters, FT, cross-chain swaps or TEE deployment become prerequisites for a truthful first demo. Preserve the visible design and state unsupported future integrations clearly. FT is a second milestone with its own token identity, storage registration and inner-receipt checks. Intents, MPC and TEE each add distinct authority and recovery boundaries and remain deferred.

## Review limits

The reviewer inspected a proposed design and source-derived research; there is no NEAR implementation to verify yet. No tests passed during this review. No audit or hackathon outcome prediction is implied. The next discriminating evidence is exact contract/API behavior under the documented authorization, concurrency, transfer-failure and callback-failure checks, when execution is authorized under the standing restrictions.

## Consolidated blueprint check

The completed `05-blueprint.md` includes all material requirements raised above: immutable request binding, original reservation/window identity, future-call revocation versus already-dispatched work, owner-paid storage/tenant accounting, payout/credential subject binding, native denomination, standard-versus-custom HTTP 402 scope, and unresolved callback liveness. No additional architecture blocker was identified in this document review.

After this review, a primary-source follow-up established the native host-balance getter/deduction behavior, and the coordinator selected a conservative aggregate available-claim backing equation in the blueprint. Refund ordering and lazy Promise construction still require receipt-level verification; existing pending transfers must not be subtracted twice from a runtime balance already debited. The coordinator also selected mandatory on-chain Ed25519 merchant invoice verification against a registered merchant key; `near-sdk` primitive availability was confirmed from tagged source. Canonical Borsh encoding, field binding and verification still require implementation tests. Neither accounting correctness nor signature-protocol correctness is validated merely by this review.

The test plan must remain subject to the standing database restriction noted in `01-near-core.md`: Sandbox persists chain database state. Writing a test plan is permitted; executing that runtime is a separate action requiring an applicable exception. This pass does not authorize it.
