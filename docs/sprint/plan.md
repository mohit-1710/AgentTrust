# AgentTrust NEAR build plan

**State:** scope frozen, 11 November 2026. Implementation authorized; progress and actual checks are recorded in the ledger. P00/P01 are planning/repository milestones.

**Goal:** an agent completes a paid service purchase while a native NEAR contract enforces the owner's supplier identity, capability and spending requirements.

**Demo:** invoice-CSV audit requested → invalid supplier credential rejected → eligible alternative paid once → real report returned and checked → revoked credential/changed identity blocks a fresh purchase → exact retry does not pay twice.

This plan selects scope; [architecture](architecture.md) fixes interfaces/invariants; [verification](verification.md) fixes the evidence bar; [workflow](workflow.md) controls commits and changes. Earlier research offered optional approvals/FT: this sprint excludes them. No placeholder approval switch, method or `RequireApproval` result.

## Clock and capacity

| Gate | UTC | IST | Observable result |
|---|---|---|---|
| Native skeleton target | Nov 11 end of focused work | Nov 11 evening | Restricted-key native payment and inspected runtime evidence |
| Paid task target | Nov 12 end of focused work | Nov 12 evening | One complete supplier-selection/payment/useful-output loop |
| UI/docs target | Nov 13 end of focused work | Nov 13 evening | Existing surfaces connected to actual NEAR facts and states |
| Feature freeze | Nov 14 06:30 | Nov 14 12:00 | Demo-path repairs only; no new features/refactors |
| Artifact freeze | Nov 14 15:30 | Nov 14 21:00 | Video, README and proposed submission ready |
| Review-ready package target | Nov 14 18:00 | Nov 14 23:30 | User can review exact final package with almost six hours remaining |
| Official deadline | Nov 14 23:59 | Nov 15 05:29 | Public repo and demo required; release/submission separately authorized |

The 30 task preparation/implementation timeboxes total **21 hours 10 minutes**. Add **2 hours 50 minutes** for review and **3 hours** of explicit runtime/hosting handoff and evidence inspection, then **6 hours 45 minutes** contingency: **33 hours 45 minutes**, with 20% contingency. This is an initial workload assumption, not a measured forecast or a commitment of the user's time. Compile delays, user availability and failed runtime checks may exceed it. Re-estimate after T04 and each milestone from actual task times; cut when work exceeds remaining capacity with the margin. Missing runtime evidence cannot be replaced by unit-test claims. The first skeleton is native authority/payment; full HTTP commerce follows on day2, without permissive policies or fake transfers.

Proposed user-run handoff windows (not calendar bookings): T13 on Nov11 20:00–21:00IST /14:30–15:30UTC; T18 on Nov12 19:00–20:00IST /13:30–14:30UTC; T26 hosting/run review on Nov13 19:00–20:00IST /13:30–14:30UTC. Each reserves execution plus result inspection beyond preparation estimates. If unavailable or a case fails, keep that gate pending and reforecast; independent work may continue, but no runtime-success claim. Delivery timing depends on these handoffs under the standing restriction.

## Frozen scope and head start

**Include:** one shared testnet native-NEAR core; direct restricted worker key; one profile/session; one capability; two controlled providers; purchase/day limits and fixed-minute dispatch count; pause/revoke; exact service trust/block; credential issue/revoke; signed invoice; reservations/callbacks; safe available-fund withdrawal; pure tests plus a separate runtime test package; custom HTTP 402; local MCP; one buyer flow; preserved website/docs design; clear evidence and reuse disclosure.

**Exclude:** stablecoins/NEP-141; Intents/MPC/TEE; standard x402-exact compliance; numeric reputation; social/transitive trust; weekly budgets; one-off approvals; escrow/disputes; marketplace; arbitrary policy language; hosted signer; production custody; dashboard redesign; extra wallets/integrations.

**Head start:** upstream visual components, animations, brand assets, Fumadocs shell and content structure; SDK/MCP patterns and old tests as case references. The native authority/money/credential path is new work. [Baseline inventory](baseline.md) lists exact reusable paths and limitations. Reused UI does not establish a percentage-complete backend.

## Stack, commands and execution boundary

- Rust pure domain crate and native core contract; verified local pins `near-sdk 5.30.1`, `near-api-js 7.4.0`, Rust1.97.1, Node24.22.2; `near-workspaces 0.24.0` is the separate Rust runtime-harness candidate for T13. T02 records the build/smoke compatibility result and exact lockfiles, not runtime compatibility.
- TypeScript/pnpm **10.33.0**, Node **24 LTS** (exact patch pinned in T02); retain upstream Next **16.2.4**, web React **19.2.4**, compatible docs React **19.2.5**, Fumadocs/GSAP dependencies. No upgrades without evidenced need.
- Vitest pure TS/HTTP tests, ordinary Rust domain tests, browser/Playwright smoke. Stateless Node service, local stdio MCP; no application database/Redis/queue/indexer.
- Hosting target: existing Next deployment shape on Vercel, one plain Node service on Render. Account availability/config/deploy authorization checked separately; no paid plan assumed. Event-permitted local service plus recorded/reproducible demo is the disclosed fallback if hosting fails. A missing hosting account does not reopen the native architecture.
- Machine currently has Node **26.7.0**, pnpm **11.24.0**, no Rust/Cargo/NEAR CLI on PATH. T02 performs setup when implementation starts. NEAR CLI is optional; reviewed SDK scripts can perform owner operations.

**Standing restriction:** the agent must not perform database/AWS/Terraform writes, including by CI or another agent. Sandbox persists a database: its runner is **USER-RUN REQUIRED**. Prepare exact commands and inspect returned evidence; do not execute it. Pure ordinary in-memory tests may run. Deployment/funding/key installation, live payment and public hosting are also outside the present planning authorization. T02 supplies the command entry points; its toolchain record distinguishes implemented checks from explicit not-ready commands.

| Command entry point, created in T02 | Purpose / effect |
|---|---|
| `cargo test -p agenttrust-domain` | Pure Rust tests; no database/chain runtime |
| `pnpm test:unit` | Vitest; explicitly excludes runtime/live cases |
| `pnpm exec vitest run <path>` | Focused TS test |
| `pnpm check:fast` | Domain + TS unit + type checks; no network mutation/runtime |
| `cargo build --target wasm32-unknown-unknown --release -p agenttrust-core` | Local WASM build |
| `pnpm build:surfaces` | Web/docs builds after generator migration; no deploy |
| `pnpm test:ui` | Local visual/flow smoke with labeled read-only fixtures |
| `pnpm verify:runtime` | Reviewed Sandbox harness; user-run under current restriction |
| `pnpm demo:prepare:testnet` | Explicit account/key/funding/deploy actions; not run in planning |
| `pnpm demo:run:testnet` | Paid flow/attacks; not run in planning |
| `pnpm evidence:check <manifest>` | Read-only evidence structure/reference checks |

Default install/test/build must not start persisted runtime, seed, deploy or pay. No upstream workflow is activated. All expected checks below mean named assertions pass and exit 0; record actual counts, never predicted pass counts.

## Fixed values and authority

- YoctoNEAR U128; JSON decimal strings; no floating money. Sample funding 1 NEAR, purchase cap 0.01, daily cap 0.05, 5 dispatches/fixed 60 seconds. Invoice 120-second default/max300; session24h; key gas allowance0.5NEAR. These are demo parameters, not production tuning.
- Same owner counters across sessions. Daily usage includes today's settled dispatches and every unresolved payment reservation across all days.
- Merchant account is service ID; payout/key/endpoint versioned. Exactly one owner-selected profile/revision per session; capability `invoice.audit.v1` with pinned suite/issuer set.
- Worker method exactly `execute_payment`, zero deposit, real signing key checked. Owner/merchant/issuer management has separate direct authority. No full-access worker key, relayer or arbitrary signing tool.
- Caller supplies stable payment ID through timeout/restart. Same ID+tuple returns saved state; changed tuple conflicts. Authorization is distinct from settlement. Unknown outcome never triggers refund/resend.
- [Architecture](architecture.md) is authoritative for signed field order, ABI, state bounds and gate precedence. SDK/UI/MCP do not duplicate policy with different semantics.

## Ordered tasks

Each task gets one accepted deliverable and a real commit `TNN: <title>`. TDD: write named behavioral failure, implement minimally, rerun focused test then fast suite. Import/setup errors are not the intended red test. Smoke: meaningful build/visual checks, no trivial tests mirroring markup. Split a task if the next independently testable behavior would exceed an hour.

### T01 Import visual baseline · on-path · day1 · smoke · 30min

**Files:** audited `web/`, `docs-site/`, required assets/config/license notices; baseline import manifest. **Consumes:** pinned upstream SHA/inventory. **Produces:** hash-recorded selective import, tagged `upstream-ui-baseline`. **Check/done:** copied paths match upstream; no active workflows/deploy configuration, `.env`, `.git`, old signer or Solana execution scripts. Chain rewrites happen later, so reused work stays unmistakable.

### T02 Pin tools and safe commands · on-path · day1 · spike · 45min

**Files:** `.node-version`, `rust-toolchain.toml`, Cargo/package/pnpm manifests/locks, TS/Vitest config. **Produces:** command contract above and compatible exact toolchain. **Check/done:** minimal domain tests, empty exported contract WASM build, TS byte-array smoke; audit default script effects. Pin actual versions. Stop spike at45min; verified dependency failure permits only a narrow logged compatibility fix.

### T03 Rust canonical encoding · on-path · day1 · tdd · 40min

**Files:** domain `types.rs`, `codec.rs`, protocol fixtures. **Produces:** `encode_invoice(&InvoiceV1)->Vec<u8>`, `invoice_hash(&InvoiceV1)->[u8;32]`, identity-descriptor encoding. **Tests:** exact field-order vector; large U128; malformed binary lengths; signature domains differ. **Command:** `cargo test -p agenttrust-domain codec`. **Done:** manually inspected expected bytes/hash and documented schema.

### T04 TypeScript codec/signatures · on-path · day1 · tdd · 40min

**Files:** SDK `types.ts`, `codec.ts`, `test/codec.test.ts`. **Produces:** `encodeInvoice(InvoiceV1):Uint8Array`, `invoiceHash(InvoiceV1):Hash32`. **Tests:** all Rust fixtures match; Ed25519 valid vector passes; amount/payout/owner/request mutation fails. **Command:** focused codec Vitest + domain codec suite. **Done:** no JSON-stringification signing or lossy integer conversion.

### T05 Owner/session authority · on-path · day1 · tdd · 45min

**Files:** contract `lib.rs`, `authority.rs`, `owner.rs`, minimal `views.rs`; pure authority cases. **Produces:** initialization and policy/profile/session ABI plus minimal `get_config/get_policy/get_session` views. **Tests:** wrong signer/key/predecessor/deposit/profile revision reject; arbitrary first caller cannot initialize; worker cannot manage policy or select weaker profile. **Checks:** pure assertions + WASM build. **Done:** caller labels grant no authority; actual key boundary reserved for T13 proof.

### T06 Funding/storage ledger · on-path · day1 · tdd · 45min

**Files:** owner ledger, domain accounting/tests, minimal `get_account` view. **Produces:** `deposit(storage_credit_yocto)` and observable aggregate available/storage liabilities. **Tests:** 1NEAR deposit with0.1 storage credit splits before priced initialization; insufficient credit rejects; no tenant cross-spend; overflow rejects. **Command:** domain accounting suite. **Done:** principal/storage/operating funds separate; T13 owns actual storage measurement evidence.

### T07 Service/credential registry · on-path · day1 · tdd · 45min

**Files:** contract `registry.rs`, domain registry validation. **Produces:** `set_service`, `issue_credential`, `revoke_credential`, bounded views. **Tests:** actor cannot alter another's record; revisions monotonic; empty required issuer set invalid; bad subject/version/suite/dates reject. **Done:** registration never means owner trust; record bounds enforced.

### T08 Ordered policy engine · on-path · day1 · tdd · 50min

**Files:** domain `policy.rs`, tests; trust/block handlers. **Produces:** `evaluate(snapshot,invoice,credential)->Decision`. **Tests:** pause/block wins; exact cap passes/+1yocto fails; credential omission/wrong issuer/scope/revocation/expiry fails; unknown denies; sibling session shares daily cap. **Command:** domain policy suite. **Done:** fixed precedence/codes; no score/approval escape hatch.

### T09 Reservation/accounting transitions · on-path · day1 · tdd · 50min

**Files:** domain `accounting.rs`, property/sequence tests. **Produces:** checked reserve/success/failure transitions with original dispatch day. **Tests:** two0.03 payments under0.05cap cannot both reserve; failure restores once but keeps attempt count; midnight/edit preserves pending exposure; old-day success touches original bucket; duplicate no-op. **Done:** conservation and cap assertions hold across sequences.

### T10 Authoritative dispatch · on-path · day1 · tdd · 50min

**Files:** contract `payments.rs`, `events.rs`, minimal `get_payment` view. **Produces:** `execute_payment(quote,credential)->ExecutionResult` and observable immutable payment state for T13. **Tests:** registered key verifies invoice; exact replay returns state; changed tuple conflicts; direct path uses evaluator; denial allocates no payment/counters. **Checks:** pure/input assertions + WASM build. **Done:** reserve/persist/schedule order explicit; no alternate worker transfer method. Promise runtime evidence T13.

### T11 Private callbacks · on-path · day1 · tdd · 45min

**Files:** `callbacks.rs`, transition tests. **Produces:** `on_payment_result`; pending/settled/failed views. **Tests:** fake predecessor rejects; duplicate no-op; definitive failure restores once; missing callback after payout keeps reservation; timeout changes display only. **Done:** bounded callback gas/storage prepared before dispatch; no automatic refund/resend/admin resolver.

### T12 Available-fund withdrawal · on-path · day1 · tdd · 30min

**Files:** owner withdrawal and private callback. **Produces:** `withdraw_available(withdrawal_id,amount)`, destination fixed owner. **Tests:** worker denied; pending principal unavailable; changed amount under ID conflicts; failure restores once; insufficient backing blocks. **Done:** available funds have a real exit with the same async discipline.

### T13 Native runtime proof · on-path · day1/2 · spike · 55min preparation

**Files:** `tests/runtime/`, runner, `docs/runtime-runbook.md`. **Produces:** reviewed `pnpm verify:runtime` user-run command/evidence schema. **Cases:** actual restricted-key/admin bypass; allowed transfer; concurrent cap; failure/refund ordering; payout success/callback failure; Promise balance deduction; post-serialization storage backing. **Done:** user-run evidence inspected against assertions. Preparation alone is incomplete. Fix any exact authority/accounting blocker before expanding the payment path; independent UI/docs may continue.

### T14 Views/SDK/finality · on-path · day2 · tdd · 45min

**Files:** broader `views.rs`; SDK `client.ts`, `directory.ts`, `finality.ts`, `owner.ts`, tests. **Produces:** `AgentTrustClient` methods and service/version→origin configuration (minimal core views already exist). **Tests:** preview declares signer possession unproven; inclusion without settled state uncertain; network/core mismatch; catalog endpoint hash/version mismatch; no configured origin; bounded paging. **Command:** SDK client Vitest. **Done:** owner helpers absent from worker tools; no arbitrary endpoint discovery; keys stay local.

### T15 Useful audit service · on-path · day2 · tdd · 45min

**Files:** example `audit.ts`, `check-output.ts`, CSV/golden JSON fixtures. **Produces:** input hash, row count, duplicate groups, rejected rows, per-currency decimal totals. **Tests:** quoted separators/newlines; duplicate vendor+invoice key; malformed/negative amounts; unsupported currencies; duplicates included in clearly labeled totals. **Command:** audit Vitest. **Done:** golden values manually checked, no floats/canned result/general financial-accuracy claim.

### T16 Validator/endpoint binding · on-path · day2 · tdd · 40min

**Files:** `validate.ts`, identity challenge and fixture-only conformance handlers, suite/evidence manifests. **Produces:** challenge verification and conformance result, then issuer-authenticated credential assertion. **Tests:** nonce/key/payout/version mismatch, redirect rejection, suite hash distinct from run-evidence hash, arbitrary CSV rejected by conformance route, failing suite cannot issue through validator. **Done:** project-operated issuer and bounded tested claim explicit; no worker issuance privilege or circular requirement to pay with a credential before testing it.

### T17 Custom HTTP402 flow · on-path · day2 · tdd · 50min

**Files:** service `server.ts`, SDK `pay-service.ts`, `attempts.ts`, HTTP/restart tests. **Produces:** `payService({serviceId,csvUtf8,paymentId})->PaidAuditResult` with exact pre-broadcast quote journal. **Tests:** forged/mutated invoice; wrong receipt resource/payee/amount/core; pending never releases; crash after broadcast loses response but reloads identical quote; not-found after unknown broadcast never triggers replacement invoice; journal-write failure stops broadcast; existing ID with changed CSV/service conflicts; settled original content retrievable after quote expiry. **Done:** provider independently checks receipt; no silent re-quote/repay or standard-exact claim.

### T18 Complete paid task · on-path · day2 · smoke · 45min preparation

**Files:** testnet preparation/run scripts, evidence manifest, two-provider fixture config. **Produces:** exact explicit owner/issuer/worker commands. **Check/done:** inspect actual network/contract/receipt/result evidence for real native payment, actual report, input hash and credential rejection without payout. User-run/authorized execution required; preparation is not runtime success. No keys tracked or owner keys passed to worker; no automatic CI/live seed.

### T19 Local MCP tools · on-path · day2 · tdd · 35min

**Files:** MCP `server.ts`, schemas/protocol tests. **Produces:** `list_services`, `get_service`, `get_policy`, `preview_payment`, `pay_service`, `get_payment`. **Tests:** stable paymentId required; no arbitrary path/raw-sign/owner method; typed denial preserved; retry cannot duplicate payment. **Done:** stdio initialize/list/call transcript, local restricted signer only.

### T20 Buyer agent/tool trace · on-path · day2 · smoke · 35min

**Files:** buyer `run.ts`, demo prompt/config. **Produces:** useful final report and actual tool trace. **Check/done:** choose qualified alternative only after definitive no-dispatch rejection; use a separately identified new attempt for that supplier. Keep the ID and exact quote within each attempt; stop on uncertain outcome. Present real agent calls when claiming autonomy; scripted harness/replay labeled. LLM cannot change policy or assert issuer trust.

### T21 Web native data adapter · on-path · day3 · smoke · 40min

**Files:** existing decisions reader/hooks/config and amount/explorer formatters. **Produces:** native events/views into existing components. **Check:** web build + UI smoke; NEAR amounts/reasons/links; pending distinct; no Solana RPC/USDC formatting; honest disconnected state. **Done:** desktop/mobile baseline comparison, no redesign/new settings dashboard.

### T22 Migrate website claims/media · on-path · day3 · smoke · 45min

**Files:** web data modules, homepage/product sections, metadata, blog/media references listed in baseline inventory. **Produces:** preserved visual design with truthful native scope. **Check/done:** keep/rewrite/remove inventory covers every active copy/media surface; rendered desktop/mobile pages contain no unsupported old proof count, numeric tier, three-program, atomic-transfer or live-adapter claim. Historical posts are labeled or removed from active marketing. This is separate from chain-reader and docs work.

### T23 Inspectable evidence detail · on-path · day3 · smoke · 40min

**Files:** existing decision detail/evidence reader. **Produces:** service/version/payout, policy, issuer/suite/expiry, operation ID, settlement and checked-output status. **Check/done:** preview versus executed rejection versus dated replay explicit; attacks legible; no fabricated tier/confidence/proof badge. A preview refusal has no invented transaction receipt. Historical replay does not masquerade as live events.

### T24 Migrate docs content · on-path · day3 · smoke · 55min

**Files:**44 MDX pages, examples/navigation. **Produces:** same shell with truthful native docs. **Check/done:** migrate/archive/remove inventory covers every page; old commands removed from active corpus, not merely sidebar; no unsupported live Solana/Monad/atomicity claims; clearly labeled historical explanation may remain.

### T25 Docs generators/context · on-path · day3 · smoke · 40min

**Files:** prebuild generators, context loader, search/llms exports/suggestions. **Produces:** generated NEAR facts and clean assistant corpus. **Check:** no obsolete namespace JSON/IDL/changelog dependency; search/Ask AI samples agree with actual native contract; `pnpm build:surfaces`. **Done:** hidden/generated content cannot restore obsolete claims.

### T26 Runnable demo environment · on-path · day3 · smoke · 40min preparation

**Files:** minimal host config/runbook, environment examples, read-only health checks. **Produces:** frontend/docs/service URLs after separate authorized/user execution. **Check/done:** TLS/origin commitment matches; core/network/code hash correct; no keys in browser; actual deployed path inspected or event-permitted local/recorded fallback explicit. No unapproved deployment/paid plan.

### T27 Whole-flow failure review · on-path · day3 · smoke · 45min

**Files:** e2e demo spec, evidence index. **Check:** allowed purchase; invalid/revoked credential; changed identity; direct bypass; duplicate; cap; pending/failure displays. **Done:** fresh bounded review has no open Critical/Important demo-path finding; actual runtime evidence inspected; two full rehearsals before recording. Fixtures are not new live runs.

### T28 Cold-read quickstart/disclosure · on-path · day3/4 · smoke · 35min

**Files:** README, setup/env docs, provenance/limits. **Check/done:** fresh reviewer follows docs alone; feature→source→command→expected→evidence map; purchase/refusal reproducible; account/API costs explicit; baseline/new diff clear; tests present versus actually run distinguished.

### T29 Record concise demo · on-path · day4 · smoke · 35min

**Files:** demo script/narration, reviewed video. **Check/done:**120–150sec target, useful result and contract rejection clear, controlled issuer/providers disclosed, no secrets, actual run IDs match evidence. Inspect playback. No posting by this task.

### T30 Freeze submission package · on-path · day4 · smoke · 30min

**Files:** final proof map, comparison tag/diff, proposed submission JSON and X draft. **Check/done:** reread current rules; correct names/tracks/links; no duplicate submission; exact package ready for user review. Public release/post/submission are separate requested actions. No AI attribution in commits; factual reuse/tool-use disclosure follows actual event rules.

## Risks, cuts and change control

| Risk | Owning tasks | Discriminator |
|---|---|---|
| Wrong authority/profile downgrade | T05,T08,T13 | Actual key cannot manage policy or select weaker profile |
| Duplicate payment/false refund | T09–T13,T17 | Stable ID across timeout; success/missing callback keeps reserve |
| Unbacked storage/refund claims | T06,T12–T13 | Actual host scheduling/serialization/refund evidence; tenant separation |
| Credential for different supplier | T04,T07–T08,T16 | Identity/payout/scope/suite mutation and revocation cannot dispatch |
| Polished UI contains old facts | T21–T25,T28 | Corpus/generator/search check plus actual native states |
| Controlled demo overstated | T15–T16,T28–T29 | Issuer/provider/suite provenance; bounded output claim |

Already cut: approvals, FT, all cross-chain systems, scores, dashboard redesign, hosted MCP and extra status/analytics/owner UI. These unallocated features cannot be counted again as recovered time. Do not restore them because early progress feels fast.

Actual scheduled reductions, in order: T23 rich evidence-detail treatment40→15min (keep existing table plus linked full JSON, save25); T24 unsupported docs rewrite55→35min (archive those pages outside active search/assistant corpus and keep a source-linked migration index, save20); T25 live Ask AI integration40→20min (preserve panel style with an honest unavailable state, keep static docs/search/corpus checks, save20); T26 public frontend/docs hosting convenience40→15min (local surfaces plus recorded actual backend evidence, no hosted/live claim, save25). These recover at most90min of task estimates; they do not eliminate required native/service runtime evidence or handoff time. Keep one capability and two controlled providers. If mandatory work still exceeds remaining capacity, explicitly report the affected gate incomplete and reduce claims; do not pretend this cut list can rescue an arbitrary delay.

Never replace native enforcement/payment with mocks or skip runtime evidence while claiming it works. If those cannot be evidenced, disclose the incomplete core and reduce submitted claims. Pure proofs do not make a production custody claim.

Reopen only on recorded correctness/security/platform evidence or a failed essential acceptance check. Record the smallest fix, affected tasks, time cost and compensating cut in the ledger. No second ideation round or broad refactor; touched-code cleanup only when needed to implement or verify the frozen behavior.
