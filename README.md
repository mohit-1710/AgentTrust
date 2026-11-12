# AgentTrust on NEAR

An agent can buy a service only from the supplier identity its owner permits, with the required capability evidence, within a bounded allowance.

**Status: native payments and the scripted MCP purchase verified on testnet.** The [r2 evidence](docs/testnet-r2-evidence.md) binds two settled 0.002 NEAR payments to the production contract, an exact retry with no second payout, and executed missing-credential, revoked-credential and changed-identity refusals. The scripted buyer selected an eligible provider and returned the checked invoice report; its saved replay made no tool calls. Actual model execution, two full rehearsals and the complete native runtime gate remain open. The [earlier gas-allowance failure](docs/testnet-evidence.md) and its original records are preserved.

Local checks cover 99 pure Rust tests and 672 TypeScript tests, plus five isolated RPC-error tests and 24 actual Rust contract-method tests with map-backed host storage. The website/docs preserve the upstream design. The compiled local stack passes two-provider HTTPS signed-quote and web/docs HTTP checks. Its actual testnet decision feed returned both settled payments and all three verified refusals; browser interaction remains untested.

The [native Sandbox capture](docs/native-runtime-evidence.md) passes 19 of 21 case groups with 116 assertions and 1,038 checked artifacts. Refund-gap and midnight/edit ordering remain separate incomplete cases. The distinct callback-fault and helper builds are disclosed in that record.

## Start here

- [Local quickstart](docs/quickstart.md): pinned tools, local checks, surfaces, provider/MCP setup and separate native handoffs.
- [Evidence map](docs/evidence-map.md): feature, source, command, expected result and actual evidence gaps.
- [Build plan](docs/sprint/plan.md): ordered tasks, acceptance checks, deadlines and cut rules.
- [Architecture](docs/sprint/architecture.md): authority, state, interfaces, settlement and custody.
- [Reuse baseline](docs/sprint/baseline.md): exactly what the existing AgentTrust provides.
- [Sprint ledger](docs/sprint/ledger.md): completed work and material decisions.
- [Runtime runbook](docs/runtime-runbook.md): explicit user-run capture, evidence inspection and remaining cases.
- [Local demo environment](docs/local-demo.md): reproducible website, docs and two HTTPS providers without cloud hosting.
- [Testnet bootstrap](docs/testnet-bootstrap.md): offline private role/config preparation and explicit user-run account provisioning.
- [Operator route](docs/testnet-operator.md): fixed role loading, paid task, model buyer, recovery and two fresh rehearsals.
- [Verification matrix](docs/sprint/verification.md): each claim and the evidence required.
- [Commit and scope policy](docs/sprint/workflow.md): real incremental history and change control.
- [Planning review](docs/sprint/review.md): material findings, incorporated fixes and remaining runtime gates.
- [Research](research/agenttrust-near/README.md): NEAR mechanics, old source, gates/lists and competition.

## Frozen first version

One testnet native-NEAR vault contract; direct restricted agent keys; per-purchase and owner-wide daily caps; fixed-window dispatch count; owner-approved services and blocks; one profile per session; accepted-issuer capability checks; authenticated invoices; payment reservations and asynchronous receipts. One custom HTTP 402 adapter, local MCP and one useful paid-service demonstration.

Keep the existing AgentTrust website and documentation design. Replace chain integrations and unsupported claims. The demonstration is a paid invoice-CSV structural audit with two controlled providers: invalid supplier evidence is rejected, an eligible alternative completes the task, and revoked evidence or a changed payout identity blocks a fresh purchase.

Unknown services deny. One-off approvals, second assets, cross-chain routing, numeric reputation and a new dashboard are outside the committed first version. Reopen a decision only for concrete correctness, feasibility or demo evidence, recorded in the ledger.

## Reused baseline and new work

Visual/source reference: [agenttrust-labs/agenttrust at 21a3b111](https://github.com/agenttrust-labs/agenttrust/tree/21a3b111b7677d0b06ab1b063d647e4f52ea3b17). Its Solana implementation and historical verification badges are prior work, not NEAR results. The `upstream-ui-baseline` tag preserves 345 selectively imported files with MIT notices and an exact [path/hash manifest](docs/sprint/ui-baseline-manifest.json). Native changes follow in separate task commits.

The older Monad project is a separate legacy repository; it is not the baseline for this NEAR implementation. See the [reuse inventory](docs/sprint/baseline.md).

## What is mocked or controlled

The providers, synthetic invoice dataset and project-operated capability issuer are controlled demonstration components. Local HTTP/HTTPS and stdio tests use explicit mock RPC or no RPC; they are not native payment evidence. The issuer's claim is limited to a named conformance suite and time. Core authorization, contract payout, settlement and replay protection must be real in the final demonstration. Testnet activity is not revenue; settled payments are not proof of service quality.

A successful transfer followed by a failed callback can leave funds reserved indefinitely. The 120-second reconciliation label is diagnostic only; this prototype has no automatic refund, resend or administrative resolver. Storage shrinkage does not refund previously charged credit.

## Verification and execution boundary

Run `. scripts/env.sh`, `pnpm check:fast` and `pnpm build:contract` for the implemented local checks. `pnpm build:services` and `pnpm build:surfaces` compile the provider and existing website/docs. See [toolchain setup and results](docs/sprint/toolchain.md) and the [ledger](docs/sprint/ledger.md) for actual verification. Native runtime and testnet commands are explicit operations: reading this repository never authorizes them. The current native verification task has specific authorization for local Sandbox execution; the standing database restriction otherwise remains. Ordinary in-memory tests and builds are separate from database-writing Sandbox/integration operations. No cloud infrastructure, production deployment, public release or event submission has been performed.

Event deadline: **14 November 2026, 23:59 UTC / 15 November 2026, 05:29 IST**. The repository is private during preparation and must be made public before submission through a later explicit release action. [Official rules](https://nearhackathon.com/HACKATHON.md).
