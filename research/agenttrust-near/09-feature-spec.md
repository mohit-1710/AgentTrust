# AgentTrust NEAR: gates, trust lists and product specification

Recommended scope, 11 November 2026. Research and design only; no implementation, contract execution or test results are claimed. This is the **current product specification** and supersedes the initial recommendation in [05](05-blueprint.md) to preserve all five old gate implementations. The custody, restricted-key and asynchronous settlement requirements in 05 still apply. [07](07-existing-gates-and-lists.md) traces what AgentTrust actually implements; [08](08-gate-design-review.md) records the design challenge; [10](10-competitive-strategy.md) explains the competitive choice.

Planning freeze: [the sprint plan](../../docs/sprint/plan.md) and [architecture](../../docs/sprint/architecture.md) turn these recommendations into the implementation contract. They select strict unknown-service denial and put one-off approvals/second assets outside the committed first version. The optional features discussed below remain rationale, not a requirement to implement them during this sprint.

## Product promise and boundary

**An agent may buy only from a service the owner permits, with the evidence that purchase requires, within a bounded allowance.** The payment contract enforces that permission even when the agent ignores the SDK or follows a malicious instruction.

The first product protects an owner's buying agent. It evaluates the **service being paid**, not a customer's social popularity or the payer's reputation. It does not guarantee delivery, truth, accuracy or commercial honesty after payment. It does not escrow, reverse payments, insure purchases or stop every form of prompt injection. A compromised agent can still spend its permitted allowance on permitted purchases; this is bounded authority, not proof of good judgment.

Keep the existing website, docs shell, navigation, typography and motion. Change the facts, controls and live data beneath them. A familiar visual design does not require copying unsupported reputation knobs or stale guarantee badges.

## The feature decisions

| Existing idea | Decision for NEAR v1 | Exact behavior |
|---|---|---|
| Emergency kill switch | Keep; mandatory | Owner-wide pause stops all new worker payouts. Session revocation stops one worker. Already dispatched payments still resolve. No disable-pause bitmask. |
| Spending limits | Keep; simplify | Per-session purchase cap plus one owner-wide UTC-day cap, in native NEAR. Successful spend and pending commitments count as specified below. |
| Weekly spending cap | Defer | More rollover state and controls without improving the first demonstration. No weekly setting until implemented. |
| Velocity gate | Change | Owner-wide maximum **dispatched attempts per fixed 60-second window**. No Solana slots, tier multiplier or claim of sliding-window throttling. |
| Counterparty tier, risk and confidence | Remove from v1 authorization | No evidenced NEAR equivalent of the old reputation source has been established. Use an explicit owner-approved service list and block overrides instead. |
| Capability validation | Keep, with a narrower meaning | An owner-selected purchase profile may require a named, versioned capability from accepted issuers. Check subject, service version, evidence scope, expiry and revocation on every new payment. |
| Trusted services | Add as an actual owner policy | Bind approval to exact registered service, payout, identity version and permitted purchase profiles. A name, URL or facilitator logo is insufficient. |
| Blocked services/recipients | Add | Owner's explicit block wins over recurring trust and one-off approval. Check both service identity and actual payout account. |
| Unknown service | Explicit behavior | Unattended default is `Deny(UNKNOWN_SERVICE)`. Intended v1 also supports owner-review mode with exact one-off approval. No automatic low-value trial budget. |
| One-off approval | Add after the core flow | Approves only the exact unknown-recipient payment. It cannot waive another failed gate or create recurring trust. If cut for time, remove review mode and return strict denial. |
| Supported facilitators | Keep as truthful integration metadata | Show implemented adapters and actual network/status. Native custom HTTP 402 is the first route; old Pay.sh/Dexter/etc. labels do not automatically carry over. |
| Payment history | Keep, relabel precisely | Settled payments, amount, recipient, timestamps and outcome evidence. No automatic stars, safety score, tier or capability promotion. |
| Social followers / inherited trust | Omit from payment permission | Following someone does not authorize spending. A future bookmark/discovery feature must remain separate. |
| Session, invoice, replay and settlement checks | Add as mandatory protocol checks | These are not optional user-configured gates. See the execution sequence below. |

The original code's five gates are useful design inputs, not a requirement to keep five switches. Its static facilitator list and accepted-attestor list are different objects, and the inspected source has no social follower graph. [Pinned source findings](07-existing-gates-and-lists.md).

## Lists: who controls them and what membership means

### 1. Owner-approved services

The owner maintains this list through authenticated management methods. The agent cannot add itself or its preferred vendor. Each entry pins:

```text
owner
network + registry/core contract
service_id + service_identity_version
payout_account
invoice_key_fingerprint + endpoint_commitment
allowed_purchase_profiles
expiry (or explicit no-expiry) + active/revoked state
```

The service account authenticates registration and changes to its own identity record. A registered service is **discoverable**, not automatically trusted. Registration proves control of that registration authority; it is not a business verification or skill assessment.

The identity version covers payout, invoice key and canonical endpoint commitment. Changing any of these requires a new version; an old trust entry or credential cannot silently follow it. For v1, require owner reapproval of the new version. This costs some convenience but makes a changed payee visible and avoids accepting a good service's identity alongside an unrelated payment recipient.

Normalize endpoint identity with one documented representation: HTTPS origin plus protected route template, including protocol version; hash the canonical bytes. The SDK pins that endpoint and request commitment. **A contract can verify commitments, not observe which HTTP server a worker actually contacted.** Describe this as binding the approved payment to an endpoint identity, not proving endpoint integrity or availability.

### 2. Owner blocks

Maintain service-ID and payout-account blocks. Either match denies a new payment even when another trust entry or old approval would allow it. No automatic global blacklist and no third-party report can alter an owner's list in v1. A merchant opening a new account is not somehow recognized as the same real-world entity; strict admission prevents the new unknown identity from automatically gaining access.

### 3. Accepted capability issuers

The owner selects issuer account IDs **per purchase profile and capability namespace/version**. Trusting an issuer to assert one capability does not make it a trusted merchant, permit other capability assertions, or grant the issuer access to vault funds.

Required credential fields:

```text
issuer + credential_id + revision
subject_service_id + subject_identity_version
capability_namespace + capability_version
conformance_suite_version + conformance_suite_hash
evidence_manifest_hash
issued_at + expires_at + revoked
```

Credential issue/revoke/renew calls authenticate the issuer account. Store the assertion locally in the core contract; the execution path does not fetch an external score or HTTP oracle. Renewal creates an explicit new revision. The owner profile pins the accepted capability/schema and conformance suite version/hash; the run's evidence-manifest hash is a separate field. A required capability with an empty issuer set is invalid configuration and fails closed. No capability required is a separate explicit profile choice.

Before issuing a credential, the validator must bind the tested endpoint to the registered identity: fetch a fresh challenge-signed descriptor or invoice from the pinned HTTPS endpoint, verify challenge, service ID/version, registered invoice key and payout, and reject cross-origin redirects. This prevents merely testing somebody else's public endpoint and registering it under an unrelated claimant's key/payout. The validator also executes the named suite and commits its inputs/results. These are issuer assertions about checks performed; the contract verifies issuer authority and credential fields, not HTTP control itself. A copied suite or shared checker can establish consistency but does not amount to an independent audit of correctness.

An accepted issuer is an owner-chosen trust root, not an independently honest oracle. The demonstration can use a disclosed project-operated validator that runs a named conformance suite and records its report hash. The claim is “this registered version passed these checks at this time,” not “this vendor is safe” or “every future answer is correct.” Expiry limits age; revocation blocks new purchases after discovery of a problem. Neither prevents an issuer lying nor a service changing behavior after evaluation.

### 4. Supported payment adapters

The application's adapter manifest describes transport compatibility: adapter ID, network, asset, core contract, protocol version, configured endpoint and `implemented`/`planned` status. It is not a merchant trust list and cannot override contract policy.

For the first version, support one custom AgentTrust native-NEAR HTTP 402 route. Keep an adapter interface for future integrations but do not build a general facilitator marketplace or on-chain facilitator governance. [Why this is distinct from upstream x402 exact](03-near-ecosystem-event.md#follow-up-standard-near-x402-exists-but-a-vault-route-is-a-different-mechanism).

## Minimal configuration and authority

Use one owner policy with a revision, rather than freely switchable policy IDs that each obtain a fresh allowance. The owner controls:

- Pause state, daily cap, maximum dispatches per minute and unknown-service mode.
- Service approvals, blocks and accepted issuers/profile requirements.
- Agent sessions: key, expiry, exactly one owner-selected purchase profile ID/revision and maximum purchase amount.

The agent has a NEAR function-call key restricted to this core contract's `execute_payment` method, with a bounded gas allowance, and an enrolled contract session. The contract checks the actual direct-call signer/key and its stored session. This permits autonomous zero-deposit calls against prefunded vault money; the key's gas allowance is not the financial allowance. [NEAR access-key semantics](https://docs.near.org/protocol/accounts-contracts/access-keys), [custody specification](05-blueprint.md#authority-and-custody).

Owner management calls must use owner authority; the worker cannot change its limits, accepted issuers, list membership, purchase profile or expiry. Registering another session does not reset owner-wide counters. Policy/list changes increment a revision and invalidate outstanding one-off approvals bound to older revisions. They do not erase spending or pending liabilities. Lowering a cap beneath existing commitments blocks new spend until enough capacity returns; it never rewrites history.

A purchase profile locks the required capability, accepted suite/schema and permitted service category for a session. Each v1 session has **exactly one** owner-selected profile ID/revision; the invoice must match it. Changing the assigned profile requires owner authority and invalidates earlier-revision approvals. A worker must not escape a required credential by relabeling the same request “no credential needed.” The demo worker receives only the credential-requiring session, never a second key with a weaker profile. General semantic understanding of arbitrary jobs is outside v1; do not claim an LLM-independent contract can understand a job's commercial purpose. Multiple differently privileged session keys must not be handed to the same untrusted worker while claiming the stronger profile is unavoidable.

Suggested demonstration values: 1 testnet NEAR prefunded; 0.01 NEAR maximum purchase; 0.05 NEAR owner-wide daily cap; 5 dispatches per minute; invoice valid for 120 seconds and capped at 300 seconds; bounded session expiry. These are demonstration choices, not calibrated production recommendations. Store raw yoctoNEAR with checked U128 arithmetic; show NEAR units in the UI. No price oracle or implicit dollar cap.

## The authoritative gate sequence

The hook is the contract's payment-admission method. SDK previews are explanations, and must be read-only. They are never permission to bypass rechecking on execution.

1. **Authenticate and bind the request.** Validate direct-call owner/session identity, schema, size and immutable payment tuple. Reject caller-invented owner/session labels. Look up existing payment ID: exact duplicates return the recorded outcome without paying again; a different tuple under the same ID is a conflict. Historical reads remain possible after expiry or pause; those reads grant no new spending authority.
2. **Apply unconditional authority checks for new dispatch.** Owner not paused, session active/unexpired, correct network/core contract, exact assigned profile ID/revision, permitted asset and nonzero bounded amount. No relayer context in this first direct-call design.
3. **Authenticate the invoice and service identity.** Verify Ed25519 signature against the registered current merchant key, service version, exact payout, endpoint/profile/resource commitment, owner/agent, asset/amount, nonce, current policy revision and expiry. Use the versioned canonical schema in [05](05-blueprint.md#the-x402-compatibility-boundary), extended with the service identity/profile fields here. Rust and TypeScript must share byte-vector checks. A caller-supplied key is not a trust root.
4. **Apply blocks.** An explicit owner block on service or payout returns `Deny(BLOCKED)`.
5. **Apply hard financial and frequency bounds.** Check purchase cap, owner-wide daily capacity, attempt count, available owner balance, storage capacity and aggregate native backing. A doomed request should not solicit an approval.
6. **Apply the profile's capability rule.** Required evidence must be from an accepted issuer and match service/version/capability/evidence policy, be unexpired and not revoked. Otherwise return `RequireValidation(reason, requirement)`. Owner trust does not bypass this.
7. **Apply recipient admission.** Exact active trust entry with matching scope passes. Otherwise accept a valid exact-payment one-off approval if review mode is implemented; absent that, return `RequireApproval` in owner-review mode or `Deny(UNKNOWN_SERVICE)` in strict mode.
8. **Commit and dispatch once.** Consume one-off approval if used, reserve balance and monetary capacity, increment attempt count, persist immutable payment and schedule the transfer in the same execution. Any failure of this receipt before commit must leave no partial authorization consumption.

Preview may show several unsatisfied conditions, but execution returns one deterministic primary reason in this order. A valid credential fixes the credential condition; it must not remain trapped in the old unrated/needs-validation early-return branch. Neither credentials nor one-off approvals turn off another required check.

## Exact approvals, retries and counters

**One-off approval:** owner approves the canonical payment hash, current policy revision and short expiry. The hash includes network/core, owner/agent/session, service identity/version/payout, profile, asset/amount, endpoint/resource/request commitment, nonce and invoice expiry. Quote changes, payout changes, policy changes or expired invoices require a new approval. Approval is consumed only at dispatch, not preview, and a failed dispatched transfer does not restore it. A new attempt requires a new invoice/approval. No “approve anyway” button overrides caps or a block. Editing policy is a separate explicit owner action.

Do not persist every unapproved request on chain. The client can hold the signed request; the owner writes the exact approval. Bound approval records and charge storage to the owner. Unapproved requests reserve neither money nor budget. In v1, inspection/approval happens in the local owner interface or CLI, with the worker key unable to approve. No automatic Slack, email or social messaging is part of this feature.

**Daily budget:** owner-wide, per native asset. At admission:

```text
settled amounts dispatched during the current UTC day
+ all unresolved outgoing payment reservations, including earlier days
+ new amount
<= current owner daily cap
```

Record each dispatch's original day. On successful settlement, move its reservation to that original day's settled spend. On definitive transfer failure, remove its monetary reservation. An old-day success can free capacity it conservatively occupied today; this is a dispatch-based budget, not a guarantee about total payments settling on a particular calendar day. Unresolved outcomes stay reserved across midnight and policy edits. New sessions and new approval entries share the same owner counters.

**Frequency:** fixed windows `floor(block_timestamp / 60 seconds)`, owner-wide across sessions. Count each actual scheduled payment once, including later failed transfers. Previews, policy denials and exact-ID retries do not count. Failure does not refund this count, so repeated failing transfers cannot evade the loop guard. Fixed windows allow a boundary burst; describe that limitation accurately. If a rolling limit becomes necessary, specify it separately rather than quietly renaming the rule.

**Gas and storage:** frequency limits bound dispatched payments, not every denied call's gas. Restrict the key's gas allowance and bound contract inputs/records. Do not describe monetary caps as preventing all fee consumption. Storage backing and withdrawal liquidity follow [05's aggregate accounting rule](05-blueprint.md#settlement-and-accounting). Receipt retention/pruning must never make an expired invoice payable again; expired requests still reject even if an old record has been archived.

## Results, delivery and the preserved UI

| Authorization result | Meaning | Worker response |
|---|---|---|
| `Allow` | Preview passes now | Execute and recheck |
| `Deny(code, details, retry_after?)` | No new payment dispatched | Select a permitted alternative, wait only for a defined limit, or stop |
| `RequireValidation(requirement, reason)` | A required issuer assertion is missing/invalid | Find a qualified service or obtain valid evidence; cannot self-certify |
| `RequireApproval(payment_hash, expiry)` | Exact unknown-recipient review is available | Wait for owner action; do not change the tuple or retry indefinitely |

Payment execution has separate states: `Pending`, `Settled`, `Failed` and `NeedsReconciliation`. `Allow` is never displayed as “paid.” A callback failure after a successful transfer cannot trigger an automatic refund or second payment. Unknown outcomes remain reserved; no trustless recovery mechanism is claimed until implemented and verified. This liveness limitation is part of the native design, not something a polished feed should conceal.

The merchant verifies the final settled receipt against its invoice, recipient, amount, request and core contract before releasing the paid response. Returning the same purchased result on a retry is permitted; the receipt cannot buy a different job. Client-side validation of a returned result is a separate observation, not a payment guarantee or basis for automatic reputation promotion.

Preserve the existing decision feed and docs layout. In its detail view, show: decision reason, service/payout, owner policy revision, capability issuer/scope/expiry when required, amount, payment status and chain evidence link. Show “owner-approved” and “credential valid” separately. Replace decorative tier/risk/confidence values with explicit unavailable/removed fields. Do not create a new large admin dashboard; use existing surfaces plus a small owner control path/CLI.

MCP first surface: `list_services` with provenance, `get_service`, `get_policy`, read-only `preview_payment`, local-signer `pay_service`, `get_payment`. Supported-adapter discovery remains read-only. Owner configuration/approval commands use a separate owner-authority path, never the worker's tool set. Hosted MCP is read-only; it does not hold a shared full-access signing key.

## What is deliberately outside v1

- Numeric universal reputation, automatic tier promotion, follower trust, third-party list subscriptions, transitive trust and global blacklist governance.
- Seller-side payer-credit screening; our first flow protects the buyer's money and checks the supplier.
- Weekly/lifetime quotas, user-authored Boolean policy language, arbitrary fiat conversion and unsupported global/collection scope switches.
- Disputes, escrow, automatic compensation and service-quality insurance.
- Multi-chain Intents/MPC, TEE claims, generic x402-exact compliance and multiple live facilitators.
- NFT agent identity, token launch, staking/slashing and a marketplace built solely to supply the demo.
- A universal prompt-injection detector. The agent may make a bad decision; enforced permissions still bound which payments can leave.

## Build priority and evidence needed

These are future acceptance criteria, **not passed tests**. The exact competitive demonstration and submission priorities are in [10](10-competitive-strategy.md).

| Order | Deliverable | Evidence before calling it done |
|---|---|---|
| 1 | Native vault, restricted key, mandatory guards, caps, reservations, callbacks | Allowed payout; direct-transfer/admin bypass rejected; over-cap and concurrent attempts cannot overspend; pause/revoke; duplicate and failure accounting |
| 2 | Registered service binding, owner trust/block, one capability and accepted issuer | Forged/wrong-subject/expired/revoked evidence cannot authorize; changed payout/version invalidates old trust; block wins |
| 3 | One actual paid API and agent loop | Agent obtains signed quote, selects eligible service, pays once and obtains a useful, request-bound result with reproducible chain evidence |
| 4 | Existing UI/docs truthfully connected | Actual decisions and settlement states; old proof/reputation/atomicity claims removed from pages, search and Ask AI corpus |
| 5 | Exact one-off approval | Unknown service pauses; owner approval works only for identical current request; amount/payout/revision mutation and repeated consumption reject |
| 6 | Submission artifacts and reproducibility | Clear reuse/new-code boundary; one setup path; expected denial cases and successful output; replay evidence labeled with capture time |

Cut scope in this order: second asset/facilitator and all cross-chain extensions; additional capabilities; rich owner controls; one-off approval mode (keep strict deny). **Do not cut recipient binding, capability enforcement for the selected demo, on-chain caps, idempotency or honest pending/failure states to preserve cosmetic breadth.** A smaller fully enforced system is a better submission than a broad dashboard.

NEAR runtime/receipt tests still need an environment permitted by the standing database-write rule. Sandbox has not been executed. Pure policy checks alone do not establish access-key or asynchronous runtime correctness. This research does not certify security, production custody or competitiveness; it supplies the concrete scope to implement and verify.
