# AgentTrust on NEAR

An agent can buy a service only from the supplier identity its owner permits, with the required capability evidence, within a bounded allowance.

**Status: implementation started.** The frozen plan is approved, and the selective UI/docs baseline is imported with exact provenance. Native NEAR implementation is next. There is no deployed NEAR contract or passing runtime test claim.

## Start here

- [Build plan](docs/sprint/plan.md): ordered tasks, acceptance checks, deadlines and cut rules.
- [Architecture](docs/sprint/architecture.md): authority, state, interfaces, settlement and custody.
- [Reuse baseline](docs/sprint/baseline.md): exactly what the existing AgentTrust provides.
- [Sprint ledger](docs/sprint/ledger.md): completed work and material decisions.
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

No product runtime is running yet. The planned providers, synthetic invoice dataset and project-operated capability issuer are controlled demonstration components. The issuer's claim is limited to a named conformance suite and time. Core authorization, contract payout, settlement and replay protection must be real in the final demonstration. Testnet activity is not revenue; settled payments are not proof of service quality.

## Verification and execution boundary

Commands in the plan are future interfaces, not currently available scripts. No runtime/deployment command is implied by reading this repository. Ordinary pure in-memory tests and builds will be separate from database-writing Sandbox/integration operations. The standing database/AWS/Terraform restrictions apply; restricted execution is prepared for the user to run themselves. No cloud infrastructure, production deployments, public release or event submission is part of this planning baseline.

Event deadline: **14 November 2026, 23:59 UTC / 15 November 2026, 05:29 IST**. The repository is private during preparation and must be made public before submission through a later explicit release action. [Official rules](https://nearhackathon.com/HACKATHON.md).
