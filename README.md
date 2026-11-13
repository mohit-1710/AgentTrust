# AgentTrust on NEAR

An agent can buy a service only from the supplier identity its owner permits, with the required capability evidence, within a bounded allowance.

**Status: two fresh local-model and MCP purchases settled on NEAR testnet.** The independently prepared [r3](docs/testnet-r3-evidence.md) and [r4](docs/testnet-r4-evidence.md) operator rehearsals each checked 23 captures and recorded five actual Ollama `qwen3:4b-instruct` responses. In each run, provider A's missing credential caused a read-only preview refusal; the model then requested the host-allowed B, while the host supplied the original payment ID and exact CSV. B's separate 0.002 NEAR purchase settled and returned a checked report. Direct executed missing/revoked/changed-identity refusals, an exact native retry with no second payout and a keyless no-model replay were also captured in each run. The separate native refund-gap case and browser visual QA remain open. The [r2 scripted qualification](docs/testnet-r2-evidence.md) and [earlier gas-allowance failure](docs/testnet-evidence.md) remain preserved.

Local checks cover 99 pure Rust tests and 693 TypeScript tests, plus five isolated RPC-error tests and 24 actual Rust contract-method tests with map-backed host storage. The website/docs preserve the upstream design. The compiled local stack passes two-provider HTTPS signed-quote and web/docs HTTP checks. Its actual testnet decision feed returned both settled payments and all three verified refusals; browser interaction remains untested.

The read-only [website](https://www.agenttrust.tech) and [docs](https://docs.agenttrust.tech) are live on Vercel. The website's [NEAR decision feed](https://www.agenttrust.tech/decisions) reads dated testnet payments and refusals; it does not initiate payments. The paid providers, MCP and model buyer still run locally. See the [hosting evidence](docs/hosting-evidence.md) for checked routes and limits.

The [native execution evidence](docs/native-runtime-evidence.md) supports 20 of 21 case groups: the broad Sandbox run passes 19 groups, and a separate midnight run proves owner edits preserve pending funds, settlement charges the original day and exact replay adds no payout. The latest midnight command completes with exit 0 and observed process-group cleanup. The refund-gap case remains open; distinct callback-fault and helper builds in the broad run are disclosed.

## Start here

### Judge path without keys

1. Follow the [local quickstart](docs/quickstart.md#1-prepare-the-pinned-tools) through `pnpm check:fast` to verify the pure contract logic, SDK and buyer behavior. This runs no NEAR transaction.
2. Run `pnpm build:services` and `pnpm test:mcp:stdio` to inspect the six real stdio tool interfaces against loopback mock RPC. The resulting transcript is labeled mock-only; the [public website](https://www.agenttrust.tech) and [docs](https://docs.agenttrust.tech) can be read without keys, or [started locally](docs/quickstart.md#2-start-the-website-and-docs).
3. Read the [public r2 proof extract](docs/evidence/r2-native/README.md) and [full r2 review](docs/testnet-r2-evidence.md#accepted-native-transactions) for the scripted qualification. Then compare the two fresh actual-model operator records, [r3](docs/testnet-r3-evidence.md) and [r4](docs/testnet-r4-evidence.md): each binds a host-scoped model tool trace, a separate settled 0.002 NEAR purchase, direct refusals, a native retry and a saved replay. The [evidence map](docs/evidence-map.md) separates local model/MCP execution from the read-only public feed and the remaining runtime/visual gates.

- [Local quickstart](docs/quickstart.md): pinned tools, local checks, surfaces, provider/MCP setup and separate native handoffs.
- [Evidence map](docs/evidence-map.md): feature, source, command, expected result and actual evidence gaps.
- [Build plan](docs/sprint/plan.md): ordered tasks, acceptance checks, deadlines and cut rules.
- [Architecture](docs/sprint/architecture.md): authority, state, interfaces, settlement and custody.
- [Reuse baseline](docs/sprint/baseline.md): exactly what the existing AgentTrust provides.
- [Sprint ledger](docs/sprint/ledger.md): completed work and material decisions.
- [Runtime runbook](docs/runtime-runbook.md): explicit user-run capture, evidence inspection and remaining cases.
- [Local demo environment](docs/local-demo.md): reproducible website, docs and two HTTPS providers without a cloud dependency for the paid flow.
- [Hosting evidence](docs/hosting-evidence.md): public website/docs deployment, HTTP checks and remaining local services.
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

Visual/source reference: [agenttrust-labs/agenttrust at 21a3b111](https://github.com/agenttrust-labs/agenttrust/tree/21a3b111b7677d0b06ab1b063d647e4f52ea3b17). Its Solana implementation and historical verification badges are prior work, not NEAR results. The `upstream-ui-baseline` tag preserves 345 selectively imported files with MIT notices and an exact [path/hash manifest](docs/sprint/ui-baseline-manifest.json). [Compare that baseline with the NEAR main branch](https://github.com/mohit-1710/AgentTrust/compare/upstream-ui-baseline...main); native changes follow in separate task commits.

The older Monad project is a separate legacy repository; it is not the baseline for this NEAR implementation. See the [reuse inventory](docs/sprint/baseline.md).

## What is mocked or controlled

The providers, synthetic invoice dataset and project-operated capability issuer are controlled demonstration components. Local HTTP/HTTPS and stdio tests use explicit mock RPC or no RPC; they are not native payment evidence. The issuer's claim is limited to a named conformance suite and time. Core authorization, contract payout, settlement and replay protection must be real in the final demonstration. Testnet activity is not revenue; settled payments are not proof of service quality.

A successful transfer followed by a failed callback can leave funds reserved indefinitely. The 120-second reconciliation label is diagnostic only; this prototype has no automatic refund, resend or administrative resolver. Storage shrinkage does not refund previously charged credit.

## Verification and execution boundary

Run `. scripts/env.sh`, `pnpm check:fast` and `pnpm build:contract` for the implemented local checks. `pnpm build:services` and `pnpm build:surfaces` compile the provider and existing website/docs. See [toolchain setup and results](docs/sprint/toolchain.md) and the [ledger](docs/sprint/ledger.md) for actual verification. Native runtime and testnet commands are explicit operations: reading this repository never authorizes them. Sandbox writes a local chain database; under the current repository restriction its runner is user-run. The accepted native captures were executed under a past, one-time exception that has ended. Ordinary in-memory tests and builds are separate from database-writing Sandbox/integration operations. Vercel hosts only the read-only website/docs; no mainnet contract deployment, public repository release or event submission has been performed.

Event deadline: **14 November 2026, 23:59 UTC / 15 November 2026, 05:29 IST**. The repository is private during preparation and must be made public before submission through a later explicit release action. [Official rules](https://nearhackathon.com/HACKATHON.md).
