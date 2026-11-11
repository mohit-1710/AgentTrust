# AgentTrust source analysis for a native NEAR port

Research date: 2026-11-10. Static inspection only; no fetched code, tests, deployments, payment calls, or database writes were executed.

Reference repository: `https://github.com/agenttrust-labs/agenttrust`, shallow clone in `.reference/agenttrust`.

Pinned revision: `21a3b111b7677d0b06ab1b063d647e4f52ea3b17`, committer timestamp `2026-05-31T15:15:00+05:30`, subject `web: bump Kani stats to 7/7 · 662 sub-checks`. This is the public default-branch revision fetched for this study; it does not establish what binary is currently deployed at any hosted URL.

## 1. What the existing product actually consists of

AgentTrust is a pre-payment policy and trust system. Its source contains three Anchor programs, an SDK, a facilitator server, an MCP server, demo/live-app surfaces, marketing pages and a docs site. It is not a payment escrow or insurance system. A successful payment says that configured checks passed; it does not prove the purchased service delivered useful work.

The core dependencies are not just Solana RPC:

| Component | Implemented responsibility | Important coupling |
|---|---|---|
| `programs/policy-vault` | Evaluate five policy kinds; persist spending/velocity counters on Allow; pause authority | Anchor account constraints, PDAs, Solana slots, Quantu ATOM accounts |
| `programs/validation-registry` | Register capability namespaces and attestors; issue/revoke capability attestations | Anchor PDA identity, slot-based expiry, transaction signer authentication |
| `programs/trustgate` | Register agents via Quantu CPI; emit feedback/dispute feedback through Quantu | Quantu `agent_registry_8004`, ATOM integration, PDA-signed CPI |
| `trustgate/sdk` | Derive accounts; load IDLs; simulate decisions; construct and submit atomic Solana settlement; register agents/validation | `@solana/web3.js`, `@coral-xyz/anchor`, SPL transferChecked, Quantu account schemas |
| `trustgate/server` | HTTP `/verify`, `/settle`, `/receipt`, `/dispute`; adapter registry and authentication envelopes | Solana proof parser, facilitator signer, Quantu resolver, in-memory replay map |
| `mcp` | 10 read tools, 8 write tools, 3 discovery tools; resources and 3 guided prompts | Solana signer resolution, Anchor chain client, bundled docs/program manifest |

SDK package is `@agenttrust-sdk/trustgate` version `0.4.1` in this revision; server is private workspace package version `0.1.0`; root is `0.0.1`. Package version is not evidence of a live deployment version. The repo packages use pnpm `10.33.0`, Node >=20 for SDK, and Anchor JS `^0.31.1`. Rust/CLI build configuration separately uses the newer Anchor toolchain. Preserve lockfiles for any reuse; do not blindly upgrade dependencies during a chain port.

Evidence: [SDK package](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/package.json), [server package](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/package.json), [MCP tool aggregation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/mcp/src/tools/index.ts#L32-L66).

## 2. Policy decision path, precisely

The pure-Rust composer is the best reusable kernel. It receives snapshots rather than performing its own RPC or CPI calls. Order is:

1. Kill switch.
2. Per-payment, daily and weekly spending caps.
3. Velocity amount cap within a reset window, using payer tier.
4. Counterparty tier, risk, confidence; unrated handling.
5. Required capability attestation.

It returns `Allow`, `Deny(reason)`, or `RequireValidation(capability_hash)`, plus optional proposed spending/velocity deltas. The wrapper applies those deltas only when all enabled policies allow. This separation should survive the port: a read-only preview should evaluate the same logic as the authoritative state-changing payment entry point.

Important details to preserve or deliberately change:

- `enabled_kinds_bitmask` can disable any check. A paused kill switch is ignored if its policy bit is disabled. The NEAR owner-facing UI must make this configuration visible; consider making emergency pause unconditional for agent-authorized spending.
- Daily spending uses UTC day indices; weekly spending uses Monday-aligned week indices. These are calendar caps, not moving 24-hour and 7-day windows.
- Zero amount is treated as a no-op by spending and velocity; the Pay.sh HTTP parser independently rejects zero. NEAR should enforce nonzero spending at its authoritative write boundary too.
- Spending uses `u64` raw amounts and the gate ignores its `_mint` argument. Limits are not keyed by asset. A multi-token NEAR port must key policies/counters by token contract ID and use `u128`/decimal strings, or explicitly support only one asset. Do not sum raw USDC and NEAR values into one cap.
- Attestations check subject, capability hash, revoked flag, expiry, and accepted attestor keys. Two zero attestor slots mean any registered attestor is acceptable. Registration alone is not proof an attestor is trustworthy.

Evidence: [composer](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/composer.rs#L110-L194), [spending arithmetic](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/spending.rs#L20-L140), [mint ignored by gate](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/gate_payment.rs#L82-L101), [attestation evaluation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/require_validation.rs#L56-L104).

### Velocity is not the advertised sliding window

The code stores a cumulative amount and `window_start_slot`; on expiry, it resets the whole amount. It does not retain individual payment timestamps or decay an aggregate continuously. Therefore it implements a reset window, rather than a true sliding window.

It also hardcodes `SLOTS_PER_SECOND = 2` and scales **window duration**, not the cap: tier 0 gets 1/4 the duration; tier 4 gets 5/4. With the cap fixed, shorter windows allow the cap to replenish more frequently. That appears inconsistent with the comment that unrated agents get a tighter throttle. This is an arithmetic interpretation of source, not a measured exploitation result.

NEAR recommendation: use block timestamps and an explicit fixed-window or bucketed sliding-window specification. For the hackathon, a clearly documented fixed window is smaller and testable. Remove the tier multiplier unless it is redesigned against explicit throughput examples and tested at boundary times.

Evidence: [velocity implementation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/velocity.rs#L17-L54), [reset behavior](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/policies/velocity.rs#L108-L154).

## 3. There are two materially different payment paths

### 3.1 SDK atomic settlement

`client.settle` loads the programs, calls `composeAtomicSettleTx`, and sends the transaction with two signers: facilitator and payer. The composer constructs:

```text
policy_vault.gate_payment_strict
  → SPL transferChecked
  → trustgate.emit_feedback → Quantu give_feedback CPI
```

All three top-level instructions are bundled into one Solana transaction. `gate_payment_strict` maps every non-Allow result to an error, so a policy rejection prevents the bundle from committing. Feedback failure can revert the transfer and counter changes within this bundle as well. This is real transaction composition in source, not just a TypeScript literal assertion.

The `AtomicityEnforced` type and runtime guard are developer ergonomics. They do not independently establish chain atomicity; the actual bundle and runtime failure semantics do that. `client.ts` retains stale prose claiming the caller must preview Allow because the non-strict handler returns Ok on Deny; the actual current composer uses the strict instruction. Prefer executable code over this stale explanation.

Evidence: [SDK settle submission](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/client.ts#L123-L162), [transaction construction](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/atomicity.ts#L164-L265), [strict wrapper](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/gate_payment_strict.rs#L27-L52), [stale SDK comment](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/client.ts#L110-L121).

### 3.2 Hosted/reference HTTP settlement

The server route has a different sequence:

```text
POST /verify:
  select adapter → parse authenticated requirements
  → RPC simulate gate_payment → format/sign decision

POST /settle:
  select adapter → parse requirements
  → validate already-confirmed transfer proof
  → emit a separate feedback transaction
  → return payment and feedback transaction IDs
```

`/settle` does not call the strict gate, does not construct a gate+transfer transaction, and does not recheck the policy. The Pay.sh adapter explicitly returns `unsignedTransactionBase64: null` because Pay.sh/client has already constructed the transfer. Feedback emission is a subsequent transaction. An HTTP `/verify` preview by itself is not a chain-enforced reservation, and a hostile or stale caller can bypass a purely advisory preview.

Do not copy a universal claim that every AgentTrust HTTP route provides atomic gate + transfer + feedback. The SDK path can compose that property; the hosted HTTP route as inspected does not enforce it. The NEAR design should have a single authoritative contract entry point for spending and use HTTP as transport around it.

Evidence: [verify route](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/routes/verify.ts#L37-L105), [settle route](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/routes/settle.ts#L82-L115), [Pay.sh response](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/facilitators/pay-sh/index.ts#L333-L345), [independent feedback emitter](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/production.ts#L283-L305).

## 4. Identity and reputation are external dependencies

AgentTrust does not implement the Solana identity and reputation engines from scratch. It integrates Quantu's `agent_registry_8004` and `atom-engine`. The policy program reads a pinned binary layout (561-byte ATOM stats, schema version 1, tier range 0..4). Immediate and confirmed tiers, risk and confidence feed checks. Feedback CPIs update the external registry and optionally ATOM.

The ATOM reader is pinned in comments to Quantu commit `bfb09ad`, plus fixed program IDs and offsets. Those are Solana-specific account bytes, not a portable reputation API. None can be reused as native NEAR reputation state by changing an RPC URL.

Hosted production wiring uses a pre-warmed counterparty JSON map and resolves only that set unless an integrator replaces its resolver. It does not establish a permissionless discovery system for every arbitrary agent. The active hosted server registers Pay.sh only, though the source tree contains implemented Dexter, atxp and MCPay adapters too. Presence in a repo or scrolling partner strip does not establish live NEAR support or a partnership.

NEAR needs an explicit replacement model:

- account-owned agent registration, with payout account and a metadata hash/URI;
- reputation facts keyed to the precise registered agent and token/network context;
- explicit source, issuer, observed-at and expiry for imported attestations;
- on-chain capability attestations from accepted attestor accounts;
- local receipt-derived payment history that is honestly labeled payment history, not service-quality proof;
- no claim that a NEAR schema is automatically ERC-8004 compatible merely because its fields resemble that ERC.

For the hackathon, prefer a small NEAR-native registry and accepted-attestor set over porting ATOM wholesale or introducing a cross-chain oracle. Any Market reputation import must be labeled an off-chain source/oracle and governed as such.

Evidence: [ATOM layout and parser](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/ext/atom_engine.rs#L1-L116), [Quantu resolver](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/production.ts#L115-L143), [hosted adapter registration](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/production.ts#L295-L309).

## 5. Authentication, challenges, replay and receipts

Useful patterns worth keeping conceptually:

- adapters normalize protocol input into one verify context;
- schemas reject unknown/invalid data and amounts are parsed as bigint;
- challenge signatures bind network, amount, asset, payout recipient, payer/payee agent IDs, policy ID, issued time and payment ID hash;
- request parsing checks intended network and rejects `payTo`/recipient drift;
- outbound decision envelopes can also be signed;
- explicit `Allow`/`Deny`/`RequireValidation` decisions are useful for agent retries and explanations;
- feedback creation is idempotent by an init-only log keyed to payment hash;
- hosted MCP is intended to avoid a shared signing identity, and local tools use the operator's signer.

But the signer model needs redesign on NEAR. In the Pay.sh adapter, the SERVICE challenge is verified using the configured facilitator fee-payer public key. That is not a generic many-independent-merchants trust registry. For NEAR, bind merchant/service issuer separately from agent owner/delegated key and relayer. Define a domain-separated payload with a schema version, `network_id`, contract ID, payer account, agent ID, payout account, token ID, raw amount string, policy version, nonce/payment ID, request hash and expiry. Verify the same binding in the spending contract. An API signature is not a substitute for spending authorization.

The source replay cache is a bounded in-memory map of signature → payment hash. Production wiring actually constructs that default. Restart or multiple instances lose coordination. NEAR should persist the authorization nonce/payment ID in contract state and make repeated identical requests return a stable outcome rather than pay again. A read cache can remain an optimization; it must not hold the only replay defense.

The existing `/receipt/:paymentIdHashHex` reads a compact feedback log containing score, dispute flag and slot. It is not a full durable payment receipt with payer, recipient, asset, amount, request commitment and settlement state. NEAR should add those fields and state transitions because external transfer promises need pending/failure handling.

Evidence: [Pay.sh schema/auth/network checks](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/facilitators/pay-sh/index.ts#L158-L250), [signature key and fields](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/facilitators/pay-sh/index.ts#L253-L273), [replay map](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/facilitators/pay-sh/proof-validator.ts#L36-L98), [production default](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/production.ts#L283-L305), [receipt endpoint](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/server/src/routes/receipt.ts#L22-L52).

## 6. Static correctness concerns to fix during the port

These findings describe this pinned source. They are not claims of exploited vulnerabilities, a formal security audit, or assertions about uninspected deployed binaries.

| Concern | What source establishes | Required NEAR design consequence |
|---|---|---|
| Unauthenticated counter consumption | `GatePayment.caller` is any signer; comments explicitly acknowledge spurious calls can exhaust spending/velocity budgets. Gate call is not forced to accompany a transfer. | Only authorized spending entry points can reserve/commit counters. Make preview a view; disallow public mutation-only gate calls. |
| Authority bootstrap race | `init_authority` takes any agent-asset ID and the code acknowledges anyone can initialize it first; no registry owner check is present in that handler. | Derive registration ownership from authenticated predecessor/delegated key, and require owner proof for authority setup and policy updates. |
| Reputation substitution | ATOM read checks program owner, byte length, schema and tiers; it does not check the stats PDA/subject belongs to the requested payer/payee. | Resolve reputation by registered agent key inside contract state, or verify attestation subject and source; never trust caller-supplied unrelated reputation. |
| Payment proof fields not bound to canonical tx message | Validator extracts fields from supplied transaction bytes, extracts `signatures[0]`, then only calls `getSignatureStatus` on that signature; it does not verify supplied message bytes against that signature or fetch canonical confirmed tx data. | Query authoritative receipt/transaction execution outcomes and verify exact contract/payment binding. Never combine a real tx ID with arbitrary client-provided amount/recipient fields. |
| HTTP settlement does not enforce gate | `/settle` validates a confirmed transfer and emits feedback separately. | Route every agent spend through contract authorization; preview must not be the enforcement boundary. |
| Asset ambiguity | Gate ignores `_mint`; policy counters are raw u64 values. | One explicit supported token for MVP, or per-token U128 budgets; no hidden cross-asset arithmetic. |
| Feedback/dispute ID collision | Both `emit_feedback` and `dispute_payment` initialize the same `feedback_log` PDA with the same payment hash. | Use separate feedback/dispute records or versioned updates referencing an existing settled payment. |
| Attestation renewal absent in main entry point | `respond_to_validation` is init-only for subject+capability+attestor, so expired/revoked entries cannot simply be replaced through this instruction. | Define revision/renewal and immutable history or latest-pointer updates. |
| Slot and tier assumptions | Hardcoded Solana slot rate, reset-window semantics, tier multiplier appears to loosen unrated throughput. | Use timestamp units and simple audited rules; explicitly test boundaries. |
| Default attestor permissiveness | No accepted keys means any attestor can qualify; namespace and attestor registration are permissionless. | Policy must choose trusted issuers; disclose demo attestations and avoid treating self-attestation as validated capability. |

Exact source anchors: [unrestricted gate](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/gate_payment.rs#L36-L79), [bootstrap race](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/instructions/init_authority.rs#L34-L88), [ATOM checks](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/ext/atom_engine.rs#L59-L116), [proof pipeline](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/onchain-validator.ts#L70-L118), [signature extraction](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/onchain-validator.ts#L155-L164), [status-only confirmation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/onchain-validator.ts#L226-L249), [feedback seed](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/trustgate/src/instructions/emit_feedback.rs#L21-L49), [dispute seed](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/trustgate/src/instructions/dispute_payment.rs#L19-L42), [init-only attestation](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/validation-registry/src/instructions/respond_to_validation.rs#L17-L57).

## 7. Validation registry scope and honest claims

The attestor signs the transaction. A 64-byte `attestor_signature` field is explicitly set to zeros as a future placeholder. The current registry is therefore authenticated by transaction signer, not by a separate independently verified detached Ed25519 attestation signature.

The request workflow and attestation workflow are not a full autonomous verification pipeline: `respond_to_validation` requires a namespace and attestor profile but does not require a corresponding `ValidationRequest` account. It records hashes and URI hashes supplied by the attestor; it does not run benchmarks or establish truth of the capability itself. Preserve this as issuer-based capability credentials, unless building a real measurement system is separately in scope.

`register_namespace` accepts the supplied namespace hash without recomputing name → SHA-256 on chain. On NEAR this is cheap enough to bind canonically, and a version should be part of capability identity if schema changes affect its meaning.

Evidence: [transaction auth and zero signature](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/validation-registry/src/instructions/respond_to_validation.rs#L1-L9), [record fields](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/validation-registry/src/instructions/respond_to_validation.rs#L59-L104), [namespace hash](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/validation-registry/src/instructions/register_namespace.rs#L1-L9).

## 8. MCP and SDK migration surface

Keep the agent-facing workflow names where they still mean the same thing: inspect policy, simulate, inspect pause/window, fetch receipt, inspect reputation and attestation, initialize owner authority/policy, pause, register attestor, request/respond to validation, explain a decision.

The current MCP's 21 tools include 8 writes but no dedicated `pay_service`/`settle_payment` tool. A working autonomous paid-service demo needs either a small local `pay_service` tool or a clearly documented SDK agent example that completes the challenge → authorized contract spend → final receipt → service response loop. Listing tools and simulating decisions alone is not the full product demo.

Preserve hosted read-only and local signer-owned operation as a product boundary, but implement that boundary explicitly. The source tool aggregator registers all tools; write handlers enforce signer presence. The public hosted README's narrower tool count can depend on deployment packaging. Do not assume merely selecting HTTP transport removes write tools: config still resolves a signer and the server uses `ALL_TOOLS`.

Rewrite `mcp/src/chain.ts`, signer/env resolution, explorer URL generation, program manifest resources, numeric types, PDA/account derivation tools, and Solana error classifier. Retain prompts/resources and Zod validation where portable. Local MCP must accept only a constrained NEAR spending credential, not a human owner's full-access key. Hosted public MCP should have no signer and expose read tools only.

The SDK's `GateDecision` union is portable. Its `PublicKey`, `ProgramIds`, `Keypair`, `BN`, IDL and transaction-return types are not. Re-export analogous NEAR functions with clear account IDs and decimal-string U128 amounts; don't fake source compatibility by accepting Solana keys as strings. Replace `settle(): TransactionSignature` with an API that returns a pending payment ID and then awaits a durable final payment outcome.

Evidence: [MCP tools](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/mcp/src/tools/index.ts#L8-L66), [all tools registered](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/mcp/src/server.ts#L142-L181), [signer config](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/mcp/src/config.ts#L280-L291), [SDK types](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/trustgate/sdk/src/types.ts#L1-L43).

## 9. Test and formal-verification claims

The source has policy pure-function unit tests, Anchor local-validator tests, adversarial tests, atomic transaction tests, SDK/server/MCP tests, and CI definitions for devnet integration, smoke checks, protocol and adapter conformance, IDL drift and Kani.

There are seven named Kani invariant families, plus a smoke harness and companion harnesses. They target pure PolicyVault logic: paused implies no Allow; allowed velocity stays within cap; tier-threshold monotonicity; expired validation rejected; distinct multisig threshold; strict decision mapping; spending caps. `strict_returns_ok_iff_allow` uses an inline helper that is literally `matches!(decision, Allow)` and compares that result with the same predicate; it does not symbolically execute the Anchor handler, runtime transaction rollback, CPI account constraints, signer authenticity, payment proof parser, or future NEAR callbacks. Its presence cannot justify a system-wide “formally verified payment stack” claim.

The website's 7/7 and 662 sub-check figures belong to the old product's historical claimed proof run. They cannot be copied as evidence for a NEAR binary. This study inspected harness code and CI definitions but did not run them or verify GitHub Actions results.

NEAR migration validation must specifically include:

1. Pure policy port tests with U128 max/overflow, time boundaries and disabled kinds.
2. Only owner can register/configure policies; a delegated spend key cannot upgrade, withdraw arbitrary funds, change recipient rules, or call management methods.
3. Preview performs no writes; untrusted callers cannot consume budgets.
4. Spend authorization binds all payment fields, network, contract and policy version.
5. Two concurrent accepted payments cannot exceed the budget including pending reservations.
6. Duplicate payment ID, repeated callback, and HTTP retry do not pay twice or double-count.
7. Native/FT transfer failure and success update balances, reservations and receipts correctly; no refund based solely on a timeout or missing callback.
8. FT registration/storage failure and returned unused amounts are handled explicitly.
9. Callback predecessor is the contract itself and expected payment state is checked; no public caller can forge settlement.
10. Service content is released only after the relevant final successful receipt; an API 200 or transaction acceptance is not sufficient.
11. Reputation record substitution, expired/revoked credentials and unaccepted attestors fail.
12. UI retains existing design while correctly showing pending, success, denied, failed and unresolved states, with real NEAR explorer links.

Evidence: [harness registry and scope](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/proofs/mod.rs#L1-L32), [strict mirror proof](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/programs/policy-vault/src/proofs/inv_gate_payment_strict_correctness.rs#L30-L103), [CI Kani workflow](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/.github/workflows/kani-prove.yml), [Anchor test workflow](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/.github/workflows/anchor-test.yml), [TypeScript test workflow](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/.github/workflows/ts-test.yml).

## 10. Reuse versus rewrite decision

| Preserve | Adapt substantially | Replace / omit from NEAR MVP |
|---|---|---|
| Existing UI styling, layout, animations, page routes and docs navigation | Chain wording, stats, contract addresses, explorers, chain data hooks | Solana/Anchor deployment scripts and IDs |
| Typed decision and denial envelope concepts | Five-kind pure policy logic, U128 arithmetic, timestamp windows | PDA byte layouts, SPL ATA logic, Quantu CPI wrappers |
| Adapter boundary and generic HTTP routing patterns | NEAR payment transport and authoritative outcome verification | Pay.sh/SVM-specific transaction parsing and unsupported facilitator claims |
| MCP resources, prompt structure and explanatory tools | NEAR chain client, constrained signing, async receipts | Shared hosted signer, default full-access owner credential |
| Existing test ideas and negative cases | NEAR-specific runtime/callback/FT test harness | Inherited 7/7 and 662 “verified” badges until rerun on exact new scope |

A minimal NEAR implementation can keep the three conceptual domains (policy, registry, receipts/feedback) as modules inside one native contract, rather than copying three separately deployed programs. That reduces cross-contract trust and callback edges for checks. External token transfer still requires NEAR-specific settlement logic. This is an architecture recommendation to combine with the separate NEAR protocol study, not an implemented result.

Recommended first demo: an agent attempts an allowed paid API request, receives a real final payment receipt and response; a second attempt exceeds the cap and is denied without value leaving; an owner pauses the agent and another payment is denied; a counterparty lacking the required accepted-attestor credential returns `RequireValidation`. Every demo badge should state whether reputation and attestations are seeded demo data or independently issued facts.

## 11. Coverage and remaining limits

Inspected core policy composer and policy arithmetic; gate wrappers; authority/policy initialization and pause; ATOM and validation readers; capability registry issue/revoke/request/namespace flows; TrustGate emit/dispute handlers; SDK settlement, derivation, simulation, types and proof validator; HTTP verify/settle/receipt/dispute; production wiring; Pay.sh parser/challenge/replay path; MCP tool registration/configuration; package versions; Kani harnesses and CI definitions. Other facilitator adapters were inventoried but not reviewed line by line. Root researcher separately owns detailed UI/docs inventory and NEAR ecosystem research.

Not established: deployed-bytecode/source equivalence, production signer configuration, successful live payment, GitHub CI pass state, measured throughput/cost, proof-run results, a formal security assessment, or x402 conformance of the proposed port. Upstream NEAR x402 support was separately verified in the ecosystem report; that does not certify the proposed vault adapter. No statements in this report should be read as execution results.
