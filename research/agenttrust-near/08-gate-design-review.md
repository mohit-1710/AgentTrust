# Product review: which gates and trust lists should exist

Date: 10 November 2026. Design recommendations, not implementation results. Read against the pinned AgentTrust source findings in [02](02-agenttrust-source.md) and the initial NEAR blueprint in [05](05-blueprint.md). This review challenges the earlier assumption that all five old policy families should remain independent v1 gates. No code, tests, chain writes, database operations, or external messages were performed.

Final integration note, 11 November: [09](09-feature-spec.md) resolves the alternatives raised here. Its unattended default is strict unknown-service denial, with exact approval as an optional complete flow; each session has exactly one owner-selected profile. Follow 09 where this earlier review discusses different defaults or alternatives.

## Recommendation

The product should answer three separate questions before each agent payment:

1. **Is this an authentic, authorized payment request?** Mandatory protocol invariants.
2. **Does the owner permit this recipient and spending?** Explicit owner policy.
3. **Does this service require a particular credential?** A conditional capability policy.

Keep those separate from whether a transport/facilitator endpoint is configured and whether a transaction has settled. A facilitator's inclusion in a supported-adapter list is not evidence that its merchants are trustworthy. An agent's social followers or self-generated payment count should not grant spending permission.

The strongest v1 is understandable without a synthetic global trust score: owner chooses allowed counterparties, unknown counterparties require exact-payment approval, explicit blocks win, and every approved payment still passes budget, authenticity, credential and pause checks.

## Revised decisions versus original five policies

| Original idea | Recommended v1 decision | Reason |
|---|---|---|
| KillSwitch | Keep as unconditional owner pause, outside optional policy bitmasks | An owner pressing pause must stop all new worker dispatch, even when other checks are disabled |
| Spending | Keep per-payment and UTC-day caps, per explicit asset/owner scope, with pending reservations | These directly bound a compromised worker's loss; no reputation source is required |
| Weekly cap | Defer from initial policy UI | Daily plus session expiry bounds first-demo risk; weekly rollover adds state/UI complexity without establishing a distinct first-demo behavior |
| Velocity | Change to a simple fixed-window maximum dispatch count; optional owner policy with a conservative default | Stops fast repeated small purchases/failing-payment loops; remove Solana slot assumptions and tier-based speed multipliers |
| CounterpartyTier/risk/confidence | Remove as a mandatory admission gate in v1; replace with owner trusted-counterparty policy | No verified NEAR reputation dataset has been established. Manually assigned demo tiers do not justify a permissionless score gate |
| RequireValidation | Keep as conditional per-policy/service requirement, not a universal check for every service | Accepted-issuer capability evidence is meaningful only when the required capability and trusted issuer are explicit |

This is a scope recommendation, not a claim that numeric reputation is useless permanently. A later provider score needs an actual source, subject binding, measurement definition, minimum evidence, freshness, and an owner-approved policy. Do not map a few successful test payments into an invented 0–100 safety score.

Source anchors for the old behavior: [composer](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/composer.rs#L110-L194), [velocity duration scaling](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/velocity.rs#L17-L54), [attestor default](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/require_validation.rs#L56-L104).

## Five lists that must not be conflated

| Concept | Owner/controller | Meaning | v1 treatment |
|---|---|---|---|
| Trusted counterparties | Vault owner | This owner permits automatic purchases from this exact service identity/payout under the policy | Build; owner writes only |
| Blocked counterparties | Vault owner | Do not dispatch new payments to this subject/payout | Build; explicit block overrides recurring trust and old one-off approvals |
| Accepted credential issuers | Vault owner/policy | These issuers may make this capability assertion | Build only as part of conditional capability gate; empty set never means everybody |
| Supported/configured facilitators | Application/operator | These adapters/endpoints are implemented and selected for a payment rail | Keep as transport configuration and discovery metadata; no merchant-trust score implication |
| Social follows/followers | Social account owner or platform | Attention/subscription relationship | Omit from payment authorization; no inherited trust or transitive trust graph |

Native agent enrollment and supported assets are also bounded registries, but their meaning is identity/compatibility. Registering an agent proves control of registration authority, not owner approval to pay it or proof of capability.

A counterparty trust entry should bind an actual registered service identity and payout account, not just a display name, logo, URL, or arbitrary reputation ID. Payout changes invalidate the previous payment permission until explicitly approved. Merchant key enrollment/rotation must be authenticated by its account; no invoice can declare its own trusted signing key. For the smallest v1, trust is per owner and service, never globally shared or transitively inherited.

If the canonical product chooses a no-approval MVP for time reasons, unknown counterparties must simply deny and tell the owner to configure trust. That is an honest smaller feature. Do not return `RequireApproval` without a complete exact-request approval and retry path.

## Unknown-counterparty behavior and approvals

Recommended default: **request owner approval for this exact payment**. A policy may instead choose unattended strict deny. Avoid an automatic low-value allowance for unknown recipients in v1: an attacker can create many recipients and drain it by splitting payments.

One-off approval is not recurring trust. Store approval against the canonical full payment hash: owner/agent, network, vault, merchant identity/payout, asset, amount, request/invoice hash, nonce, expiry and policy version. It should have a short expiry, be single-use, and be created only through owner authority. Do not let the autonomous worker approve itself.

On execution, run all current gates again. Approval grants only the exception for an unknown counterparty. It never overrides an explicit block, pause, revoked/expired session, invalid/expired invoice, insufficient balance, exhausted budget or a required missing/revoked capability. A changed quote, recipient, request, policy version or expired invoice requires a new approval. Approval and pending-payment status are distinct.

For recurring trust, the owner separately chooses “trust this service for future payments”; the normal policy caps still apply. The default approval action must not silently enroll the service in that list.

Approval requests should not reserve spend capacity. Budget is reserved only when an authorized payment is ready to dispatch. Otherwise an agent can fill a queue of unapproved requests and starve legitimate payments. Bound approval-request count/size and charge storage to its owner; suppress duplicate notifications for the same payment ID.

## Gate order and precedence

The contract is authoritative. The SDK/hook can preview the same rules and explain them, but preview can go stale.

1. Authenticate the owner/session and exact payment tuple. Malformed/forged/replayed requests cannot create arbitrary owner records or consume spending counters.
2. If this is an exact retry of an already-dispatched payment, return the recorded state without a new payout. A changed tuple under the same ID is a conflict. Returning an existing settled receipt while paused is safe; pause stops new dispatch, not historical reads.
3. Check unconditional owner pause, session validity/revocation and supported asset/network.
4. Verify merchant registration/payout binding and canonical signed invoice, including request commitment and expiry.
5. Enforce explicit owner blocklist. Block beats trusted status or one-off approval.
6. Check per-payment/day budget, dispatch-count limit, available owner funds and aggregate solvency. A request that cannot pass a hard limit should not trigger an approval prompt.
7. Check a required capability against explicit accepted issuer(s), subject, namespace/version, expiry and revocation. If this fails, return `RequireValidation`; do not ask the owner for generic trust approval as if that cured missing evidence.
8. If the counterparty is not in this owner's trusted list and has no valid exact-request approval, return `RequireApproval` or strict `Deny` according to the owner's mode.
9. Atomically consume the approval if used, reserve spend/balance and increment the dispatched-attempt counter, then dispatch once.

The explanatory preview may include multiple failed checks so the user sees all needed changes, but the write method should return one deterministic primary result using documented precedence. Never dispatch when any required gate is unsatisfied.

## Counter semantics

- Monetary budget includes successful payments plus all pending reservations. Release monetary reservation only for an authoritative failed transfer; an unknown outcome remains reserved.
- Dispatch-count velocity increments once when a payout is actually scheduled and remains consumed even if the transfer later fails. Otherwise repeated failure/refund loops can avoid the rate limit while burning gas and creating work.
- A denied preview/request is not a dispatched attempt and must not consume monetary budget. Read-only preview performs no writes.
- Count/amount scope should follow owner plus agent/policy and asset as specified; workers cannot evade an owner-wide daily cap by switching policy IDs or sibling sessions. Decide and document that aggregate scope in the final specification.
- Preserve charged window IDs on pending payments. Retry, callback, day rollover and policy edits cannot charge twice or erase old liabilities.
- Rate limits describe a documented fixed window. Do not call it a rolling/sliding window or adjust speed from synthetic reputation tiers.

## Capability policy must stay narrow

Require a capability only when the owner actually needs that assertion for this class of purchase. An owner-trusted provider and an accepted attestor are separate authorities: trusting a merchant does not make its self-issued credentials valid.

V1 can demonstrate one versioned capability with one explicitly configured demo issuer. State exactly what the issuer checked. “Supports a response schema” can be a narrow compatibility assertion; it is not a verified-quality or accuracy guarantee. A seeded credential demonstrates the gate mechanism, not independent measurement. Do not add TEE, human identity, audit certification or benchmark namespaces without implementing their actual verification procedure.

If capability is required but accepted issuers are empty, policy creation should reject the configuration or execution should fail closed with a configuration error. Do not retain the original permissive empty-set behavior. Missing/expired/revoked/wrong-subject/unaccepted evidence never grants payment; tell the agent which requirement remains unmet.

## Decision API and demo

Keep payment authorization and settlement separate:

| Authorization result | Meaning / next action |
|---|---|
| `Allow` in preview | Current checks pass; execution must recheck |
| `Deny(reason, retry_after?)` | No payment; change configuration/request or wait for a defined rate/window limit |
| `RequireApproval(payment_hash, expires_at)` | Owner can authorize only that unknown-counterparty request |
| `RequireValidation(capability, accepted_issuers)` | Obtain acceptable unexpired evidence and retry |

Execution success initially returns a payment ID and `Pending`. Later views report `Settled`, `Failed` or `NeedsReconciliation`. A successful transfer records payment execution only; it must not automatically produce a five-star service review. Verified service delivery/quality feedback is a later separate feature with its own evidence.

Recommended end-to-end demo:

1. Agent buys from owner-trusted service, within budget, with any required valid credential: one real payout and resource response.
2. Agent attempts an unknown service: exact request awaits owner approval; approval does not enroll recurring trust.
3. Owner approves, but changing price/payout/resource invalidates it; original exact request can dispatch once.
4. Block the provider: another payment is denied even if recurring trust or an older approval exists.
5. Exceed spend or burst cap: deny without another payout; a loop cannot consume all owner funds.
6. Required credential expires/revokes: `RequireValidation`; trusted status does not bypass it.
7. Retry an uncertain payment: same operation, no double payment. UI shows pending/reconciliation separately.

If time is tight, a credible demo can choose steps 1, 2/3, 4/5 and 7, with the capability path shown only if actually implemented. Do not fake core enforcement or label UI fixtures as chain outcomes.

## What to remove from the initial plan

- Preserve the old five names only where they still express actual behavior; there is no requirement to keep five independently configurable gate modules.
- Remove universal counterparty tiers, inferred risk/confidence, follower/social proof, transitive trust, and automatic score increases from tiny/self payments.
- Defer weekly/lifetime budgeting knobs, arbitrary Boolean policy languages, large namespace catalogs, imported marketplace reputation, global blacklist governance, and automatic escalation/approval messaging until a real need exists.
- Avoid a generic “override all gates” owner approval button. Owners can intentionally change policy through a separate explicit action; one-off recipient approval should stay narrowly scoped.
- Keep facilitator discovery as configuration. Never make a familiar facilitator logo a substitute for merchant identity, signed payment binding, and exact chain outcome verification.

The canonical specification should replace [05's](05-blueprint.md) “keep all five policy concepts” assumption with an explicit v1 gate/list decision table and exact precedence. This review supplies product decisions; it does not certify implementation or predict hackathon judging results.
