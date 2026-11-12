# Sprint ledger: docs/sprint/plan.md

Mode: implementation authorized 11 November 2026; accepted milestones are committed and pushed regularly. Repository: `mohit-1710/AgentTrust`, private. Build cadence authorized: accepted task commits pushed to private main. Deadline Nov14 23:59UTC / Nov15 05:29IST; feature freeze Nov14 06:30UTC /12:00IST.

P00 done eab313e | research and ignore boundary committed and pushed; remote main/tag verified | checks: research local links/fences, staged whitespace, no reference clones/credentials/workflows tracked | no product/runtime tests

P01 done b16c4b2 | architecture, baseline inventory,30-task plan,35-case verification matrix, workflow and project instructions | fresh static review findings incorporated and bounded recheck completed;22 Markdown files passed local path/fence checks; task references/sequences valid; whitespace and credential-pattern checks clean | implementation not started

Ruling: preserve old Monad project as `mohit-1710/AgentTrust-Monad-Legacy`, private and detached | user explicitly authorized rename/privacy; new AgentTrust name needed | same main SHA `ac5638ea69d46aa7e024fd169fc5efbf181da352` verified; local mirror backup ignored | original GitHub fork relationship no longer exists

Ruling: new standalone private `mohit-1710/AgentTrust`; local root is current workspace | clean NEAR provenance and correct personal account | upstream UI imported separately in T01 with exact source pin and license notices

Ruling: freeze strict unknown-service denial, no one-off approvals in committed scope | complete credential/payment path takes priority | optional approval would require full new specification/tests after core and sufficient time

Ruling: one native asset, one capability, two controlled providers; same UI/docs design | coherent end-to-end proof before breadth | no stablecoins, cross-chain tools, scores or redesign

Ruling: preserve current research, but build plan/architecture supersede research alternatives | avoid repeated ideation/refactoring | reopening requires evidence and a compensating scope/time decision

Ruling: no inherited upstream workflows/deploy scripts activated | some start persisted validators or make chain writes | selective import only; never run old root `pnpm test` as NEAR verification

Ruling: runtime tests are mandatory evidence but Sandbox execution is user-run under standing database-write restriction | host hard rule applies even to local test databases | no CI/subagent workaround, no false runtime pass

Ruling: no new memories written | user did not request memory updates | all task state lives in this repository

Current machine observation: Node26.7.0, pnpm11.24.0; rustc/cargo/near absent from PATH. Toolchain compatibility/setup is T02; no dependencies installed in planning.

Next: inspect the user-run T13 native evidence when provided; implement T17 paid HTTP flow and integrate reviewed T24/T25 docs. T01–T12,T14,T15 accepted locally; T13/T16 prepared and integrated; T17/T22/T24/T25 in isolated worktrees. T13 runtime gates remain open. No deployment, funding, key installation, live payment, public release, X post or submission performed.

Ruling: user authorized implementation and regular private commits/pushes on 11 November | proceed through frozen tasks without repeated design approval | public release, restricted runtime, deployment and spending remain separate gates

T01 done 1474769 | imported345 exact files and43 explicit exclusions, preserved MIT notice | checks: python3 scripts/verify-ui-baseline.py; clean pinned reference; one inherited trailing-space line retained for exact bytes | gate: fresh review spec/quality pass,0 Critical/Important; historical wording fixed | no install/build/runtime execution

Ruling: Rust near-workspaces0.24.0 is the runtime harness candidate, not an npm package | official crate metadata confirms the version | T13 must isolate it and avoid default Sandbox-download lifecycle in ordinary builds

Ruling: near-sdk5.30.1 requires cfg(near) for native host bindings | exact SDK source distinguishes generic WASM fallbacks | T02 configures target rustflags and inspects host imports in the compiled artifact

Ruling: profile IDs are1–64 UTF-8 bytes without normalization | codec preparation exposed an unbounded storage key in the frozen schema | same bound in Rust/TS and owner management; T03/T04 boundary tests, no feature expansion

T02 done 4bd7566 | pinned Node24.22.2/pnpm10.33.0/Rust1.97.1; safe Rust/TS workspace and lockfiles | checks:1Rust+2TS tests, native typecheck, fmt, frozen lifecycle-free install,13,733-byte WASM with NEARhostimports; no WASM execution | gate: fresh spec/quality pass,0 Critical/Important; docsReact drift fixed via scoped override | report:toolchain.md; no runtime/chain deployment

Ruling: canonical invoice/descriptor numeric u8/u32 fields accept parsed finite integral values in range, including1.0/1e0 and-0 | Rust/JS lexical number differences do not affect signed Borsh bytes | shared28-case token fixture; amount/timestamp parsing remains strict decimal strings

T03 done 83fc05f | pure Rust invoice/identity types and canonical Borsh/hash functions; independent annotated Python vectors | red:10 explicit codec stubs failed, then numeric parity regression failed; green:11 codec tests/12Rusttotal,42 malformed field cases,28 numeric-token cases,2TS tests/typecheck/fmt/WASM | gate: fresh spec/quality pass, no findings | signatures and runtime still pending

Ruling: T05 may prepare in isolated sprint/t05 worktree while T04 implements the TypeScript codec | both consume the accepted Rust schema and change disjoint implementation files | integrate T04 then T05 through separate review/check/commit gates; no parallel mutation of main

Ruling: capability DTO uses namespace invoice.audit and version1 to represent invoice.audit.v1, with conformance_suite_version/hash and1–4 unique accepted_issuers | explicit field names for T05/T07; no duplicate version suffix or general capability framework | null remains the explicit no-requirement profile

T04 done ef235d6 | TypeScript invoice/identity codecs, hashes, strict input validation and explicit-registry-key Ed25519 verification; public RFC8032 signature fixtures | red:120 focused cases failed against explicit stubs; green:123 focused cases/125TS total,12Rust total and typecheck | gate: fresh spec/quality pass, no findings | no real account keys, signing transaction, runtime or chain execution

T05 done b3c665b | contract-account initialization, direct one-yocto owner management, immutable key/profile sessions, bounded state and minimal views | red:9 authority stubs plus storage-credit stub failed; integrated green:22Rust+125TS tests, typecheck/fmt,167,462-byte WASM with required ABI/host imports | gate: fresh spec/quality pass, no findings; isolated source integrated and full checks rerun | funded actor creation and runtime proof remain T06/T13

Ruling: prototype storage shrinkage does not refund previously charged credit | retain simple conservative storage accounting; growth remains actor-funded | no claim of refundable storage or available principal; disclose with T28 limitations

Ruling: prepare T15 pure CSV audit in isolated sprint/t15 worktree alongside core work | independent provider computation/fixtures share no mutable core files | review and integrate at its later gate; no HTTP/payment/runtime shortcut and no completed-task claim yet

T06 done d185ce0 | direct deposits, sole funded actor creation, checked principal/storage split, actor-paid persisted storage growth and observational get_account | red:9 accounting stubs failed; green:31Rust+125TS tests, typecheck/fmt,173,500-byte WASM | gate: fresh spec/quality pass, no findings | no native transfer/runtime claim; T07 must flush all registry writes before shared storage pricing

T15 preparation ready in isolated sprint/t15 |64 audit/checker tests,22Rust+189TS/typecheck passed on its T05 base;4 manual goldens cross-checked independently | fresh spec/quality review passed with no findings; not integrated or marked done, no HTTP/payment/runtime claim

Burn check after T06: six accepted local milestones are within their initial preparation timeboxes; no cut justified | keep original allowances for unresolved runtime, HTTP integration, UI/docs and handoffs rather than extrapolating codec speed | feature freeze unchanged; no deployment or native runtime gate passed

T07 done f2f7bc0 | versioned merchant-owned service identities, issuer-scoped credential issue/revoke/renew and bounded views/index | red:12 registry stubs failed; green:43Rust+125TS tests, typecheck/fmt,214,839-byte WASM | gate: fresh spec/quality pass, no findings | revoke retains assertion revision; renewal increments; all writes charged to responsible actor after flush; no runtime claim

Ruling: prepare T24 documentation content in isolated sprint/t24 while core proceeds | frozen semantics and current ABI support independent prose migration | preserve design, account for all44 inherited pages, keep unsupported history outside active search/assistant corpus; integrate/render later, no completion claim yet

T08 done 410799b | ordered pure policy evaluator and native exact-service trust/block management | red:21 evaluator/list stubs failed; green:64Rust+125TS tests, typecheck/fmt,254,138-byte WASM | gate: fresh security-focused spec/quality pass, no findings | consistent storage/backing projection; inactive trust retained, blocks active-only; actual dispatch and runtime pending

T09 done 66b99c5 | immutable payment evidence, owner-wide reservations, original-day settlement and exactly-once failure restoration | red:10 reservation stubs failed; green:74Rust+125TS tests, typecheck/fmt,263,334-byte WASM | gate: fresh spec/quality pass, no findings |24 conservation sequences, concurrent caps, midnight,128 retained records and actual-balance refund gap covered in pure transitions; host dispatch/callback/runtime remain pending

T15 preparation pushed 0c3ca7e on sprint/t15 | reviewed pure CSV audit and independent output checker | integrate at its dependency gate and rerun integrated checks; no HTTP/payment claim

T24 preparation pushed 2aec257 on sprint/t24 |34 native MDX pages,11 byte-preserved archives and44-page migration inventory | fresh content/spec review passed; mapping/hash/link/navigation/AST checks passed | reconcile snapshot at integration; generators/assistant/search/render verification remain T25

T10 done 5eb5f12 | authoritative worker admission, registry-key host signature call, immutable retries, priced reservation/index and actual-balance guard before one explicit native Promise transfer | red:9 admission stubs failed; green:83Rust+125TS tests, typecheck/fmt,338,837-byte WASM with required host imports/exports | gate: fresh spec/quality pass, no findings | receipt-local observations and diagnostic views added; callback absent at that historical milestone

Ruling: T12 pure withdrawal accounting and T13 runtime harness may prepare independently while T10 completes; T16 consumes reviewed audit fixtures in its own worktree | no overlapping main implementation, no runtime/issuance execution | integrate and review each task separately; preparation is not a passed gate

T11 done cf28cdb | private self/exactly-one-result callback, bounded native result handling, fixed-size finalization and receipt-local backing observations | red:2 authority stubs failed; green:85Rust+125TS, typecheck/fmt; production344,684-byte and isolated fault341,694-byte WASMs inspected without execution | gate: fresh spec/quality pass, no findings | unexpected result aborts rather than refunds; default-off fault feature has no public switch/resolver; artifact-kind mismatches rejected; actual host gas/storage/refund/rollback remain T13

T16 preparation pushed 97966b3 on sprint/t16 | signed fresh identity challenge, committed fixture-only conformance and scoped assertion draft with separate evidence hash |69 focused tests,74Rust+258TS/typecheck on isolated base; fresh spec/quality pass, no findings | no live HTTP/credential issuance; T14 registry/directory, T17 route and T18 issuer integration pending

T12 done dfa47ba | direct owner-only available withdrawal to self, immutable replay/status views, priced backing guard and private exactly-once callback | red:7 pure transition stubs then4 storage/view stubs failed; green:96Rust+125TS, typecheck/fmt, production365,092-byte and separate fault362,921-byte WASM inspections | gate: fresh spec/quality pass, no findings | shared8 outstanding, no worker budget use, pending funds/storage/operating reserve excluded; no native execution claim

T13 preparation review found and is repairing an RPC error-cause classification defect and tool-version provenance labeling | permission rejection must be distinguished from transport failure | no runtime evidence exists; missing refund-gap/midnight and further matrix variants remain explicitly open

T13 preparation integrated 594b981 | separate user-run harness, explicit FINAL receipt capture, typed invalid-key error probes and read-only artifact checker | integrated checks:96Rust+150TS/typecheck;5 explicitly named pure RPC-error regressions; standalone cargo check; no harness/Sandbox execution | fresh review Important/Minor findings fixed and bounded recheck passed | T13 remains incomplete: no runtime capture; refund-gap/midnight and other listed matrix variants open

Ruling: freeze a clean native-runtime-candidate-1 checkout for the user-run handoff while independent SDK/docs preparation continues | keep source/production/fault artifacts stable during capture | no deployment or Sandbox execution by agent; capture must be inspected and cannot complete absent cases

T13 source audit: nearcore2.14 can route a zero-congestion-gas Data receipt ahead of a buffered Action refund under the documented conditions | generation order is insufficient proof of liquid backing | docs/runtime-refund-order.md records primary sources and inference limits; retain actual-balance guard and empirical gap

T13 user-run handoff prepared c4a3dde, tag native-runtime-candidate-1 | clean detached checkout with separate hashed production/fault WASMs and pinned downloaded Sandbox binary; helper syntax checked, not executed | user notified of exact local command; capture and incomplete-case review pending | frozen checkout/artifacts remain unchanged while independent work continues

T15 done cc4ee45 | integrated reviewed invoice audit engine, independent output checker and four manually checked golden fixtures from sprint/t15 | 64 focused tests; integrated214TS tests and typecheck passed | gate: fresh spec/quality pass, no findings | exact integer totals include valid duplicates, totals are not payable amounts; no provider runtime claim

T16 preparation integrated 5ee0b54 | signed identity challenge, fixed-fixture conformance route logic and scoped validator assertion/evidence draft | 69 focused tests; integrated283TS tests and typecheck passed | gate: fresh spec/quality pass, no findings | live HTTP route and credential issuance remain T17/T18; no runtime attestation claim

T14 done 750ec72 | bounded policy/profile/service/payment views, read-only preview, explicit service directory and local restricted-key SDK with finality-aware recovery; owner helpers are a separate entrypoint | integrated99Rust+340TS tests/typecheck/fmt; production381,471-byte WASM inspected without execution | gate: fresh review P2 exact-submission binding fixed with9 regression cases, bounded recheck passed; T11/T12 exports and fault guards preserved | no live RPC or native runtime evidence; final admission is not necessarily settlement

Day2 burn check, 12November16:26IST: official deadline reverified unchanged, about61h to submission and43.5h to feature freeze | prioritize T17/T18 paid path and native runtime evidence, with independent surface migration in isolated worktrees | no scope expansion; task estimates remain assumptions, no completed end-to-end demo claim

Ruling: user requested full build ownership with no browser activity on 12November | all further verification uses terminal/HTTP checks and previously captured artifacts; no browser tools or headless browser launches | remaining visual acceptance is recorded, not inferred

T24/T25 preparation integrated f0f5646/812fa71 | reviewed native34-page corpus,11 exact archives, source-backed generators, pure search and default-disabled assistant; reconciled docs with integrated T14/T15 and preparedT16 | integrated build:surfaces, generated drift checks, corpus checks,3 search tests, docs lint/typecheck passed; GET smoke34HTML/34Markdown/11archive404 plus search/LLM/OG/assistant checks passed | fresh spec/quality review no Critical/Important; docs desktop/mobile interactions not performed, browser restriction now applies | no native runtime or live Ask AI claim

Ruling: SDK executePayment returns a SubmissionResult wrapper around on-chain admission plus transaction/receipt provenance, with uncertain alternative | an RPC result cannot stand in for settlement; T14 exact-submission recovery and beforeBroadcast checkpoint require locator retention | architecture and SDK docs reconciled; no contract ABI change
