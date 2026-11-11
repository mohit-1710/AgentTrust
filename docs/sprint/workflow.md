# Build workflow and scope freeze

Frozen 11 November 2026. The user authorized implementation and regular private commits/pushes after approving the frozen plan. This file controls build discipline; it does not override standing host restrictions.

## Authority

- Root workspace: this repository; remote `mohit-1710/AgentTrust`, private.
- In-scope implementation and regular private-repository commits/pushes are authorized.
- Implementation began on the user's 11 November build instruction. No repeated design approval is needed for routine choices within this frozen plan.
- No public visibility change, deployment, financial transaction, external message or submission is authorized by this planning phase.
- Database, AWS and Terraform write restrictions remain in force. Prepare exact commands/tests; prohibited operations must be run by the user. A remote CI job must not be used to bypass the restriction.
- No inherited upstream workflows/deployment files are activated. Read their effects before any selective import.

## Honest commit history

Bootstrap milestone P00 commits the existing research and repository boundary. P01 commits the reviewed architecture, sprint plan and acceptance matrix. These are actual completed planning deliverables, with normal current timestamps.

During the build, each independently accepted task gets `TNN: concrete change` and the relevant checks. Split a task only if each part is meaningful; combine tiny coupled edits when neither is reviewable alone. No empty cadence commits, backdating, artificially split files or copied proof claims. No AI co-author trailers or generated-by messages. Preserve required third-party license notices.

Use `main` for this sole-owner private sprint until collaborative changes make a branch necessary. Commit only reviewed explicit paths, then push accepted milestones to the private remote. Recheck `origin` and private visibility before the first build push. This ongoing cadence is explicitly authorized. Review unrelated work before staging; do not use blanket `git add .`.

Each task follows: read brief → focused failing test where meaningful → minimal implementation → targeted checks → fresh review of security-critical changes → commit → ledger entry. Pure UI migration uses visual/build smoke checks, not tests that simply mirror JSX. One implementer owns the main working tree at a time; parallel agents may own disjoint documentation or read-only reviews. Use isolated branches/worktrees for simultaneous code changes and integrate sequentially.

The ledger's completion line rides with the next real commit so it can name the previous task's actual SHA. Do not invent hashes or create a new commit just to record its own hash. Preserve granular task commits at submission; create the final comparison tag without squashing away the build history. Existing-source import is visibly labeled as prior work.

## Scope changes and refactoring

The fixed feature contract is [plan.md](plan.md), backed by [architecture.md](architecture.md). [The feature research](../../research/agenttrust-near/09-feature-spec.md) supplies rationale, but this plan selects strict unknown denial and excludes optional one-off approval from the committed first version.

A change requires one of: a reproduced bug/security gap; verified platform incompatibility; an acceptance test exposing an impossible design; or clear evidence that the demo cannot communicate/complete the promised behavior. Record `Ruling: evidence | smallest change | affected tasks | time cost | compensating cut`. Review only that affected decision. A new competitor feature, aesthetic preference or hypothetical future extensibility does not reopen architecture.

Refactor only within touched code to make the current behavior correct/testable, while checks stay green. No broad renaming, dependency upgrades, folder reorganizations, replacement frameworks or additional policy abstractions once building starts. A dependency security/correctness issue is a valid evidence-based exception.

## Freeze and recovery

Feature freeze: **14 November 12:00 IST / 06:30 UTC**. After it, demo-path bug fixes only. Artifact freeze: **14 November 21:00 IST / 15:30 UTC**. Target complete reviewable submission package: **14 November 23:30 IST / 18:00 UTC**, before the official **14 November 23:59 UTC** deadline.

At each completed milestone compare actual remaining effort to available focused time. Keep at least 20% repair margin; cut scope early when it does not fit. Remove additional integration/UI polish first. Never cut authority, correct reservations, invoice/identity binding, duplicate safety or honest states to preserve a broader pitch.

If an operation needs a prohibited write, mark that verification `USER-RUN REQUIRED`, deliver its exact reviewed command and expected evidence, and continue independent work. Never label the overall runtime gate passed until the user supplies the results for inspection. A mock or unit-test result cannot replace missing runtime evidence.

## Resume

Read README, plan, architecture, ledger and recent `git log`. Resume the first task not recorded complete. Keep an interrupted partial task visible; do not reinitialize or rebuild prior milestones. This workspace's ignored `.reference/` is local evidence, not a tracked dependency.
