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

Next: T03. T01–T02 accepted; T03–T30 pending. P01 completion is evidenced by its Git commit; the next real milestone may record that hash here. No deployment, funding, key installation, live payment, public release, X post or submission performed.

Ruling: user authorized implementation and regular private commits/pushes on 11 November | proceed through frozen tasks without repeated design approval | public release, restricted runtime, deployment and spending remain separate gates

T01 done 1474769 | imported345 exact files and43 explicit exclusions, preserved MIT notice | checks: python3 scripts/verify-ui-baseline.py; clean pinned reference; one inherited trailing-space line retained for exact bytes | gate: fresh review spec/quality pass,0 Critical/Important; historical wording fixed | no install/build/runtime execution

Ruling: Rust near-workspaces0.24.0 is the runtime harness candidate, not an npm package | official crate metadata confirms the version | T13 must isolate it and avoid default Sandbox-download lifecycle in ordinary builds

Ruling: near-sdk5.30.1 requires cfg(near) for native host bindings | exact SDK source distinguishes generic WASM fallbacks | T02 configures target rustflags and inspects host imports in the compiled artifact

Ruling: profile IDs are1–64 UTF-8 bytes without normalization | codec preparation exposed an unbounded storage key in the frozen schema | same bound in Rust/TS and owner management; T03/T04 boundary tests, no feature expansion

T02 done in this task commit | pinned Node24.22.2/pnpm10.33.0/Rust1.97.1; safe Rust/TS workspace and lockfiles | checks:1Rust+2TS tests, native typecheck, fmt, frozen lifecycle-free install,13,733-byte WASM with NEARhostimports; no WASM execution | gate: fresh spec/quality pass,0 Critical/Important; docsReact drift fixed via scoped override | report:toolchain.md; no runtime/chain deployment
