# AgentTrust NEAR working instructions

Read `docs/sprint/plan.md`, `architecture.md`, `ledger.md` and recent Git history before work. The sprint plan is the scope authority; research files explain decisions and may contain superseded alternatives.

- Implementation and regular private milestone commits/pushes are authorized. Preserve the existing website/docs design.
- Resume the first incomplete task. Never mark a task done because code exists; use its acceptance checks and record what actually ran.
- Native NEAR only for this sprint. No second chain/asset, numeric reputation, one-off approval feature, arbitrary policy framework or dashboard redesign.
- Refactor touched code only when necessary for the current behavior or a reproduced defect. Reopen scope only with concrete correctness/security/platform evidence; log the smallest change and compensating cut.
- Host database/AWS/Terraform restrictions apply. In particular, do not run Sandbox or delegate its database writes to CI, tools or another agent when prohibited. Prepare the exact user-run command and inspect returned evidence. Pure tests must use ordinary in-memory values, not a database.
- No inherited upstream workflows, install hooks, deployment scripts or live-chain tests may run without inspecting effects. Do not use the old Anchor `pnpm test` as native verification.
- Use only restricted worker keys for the agent/MCP; never include owner/deploy keys in its environment or browser bundle. Keep credentials and attempt journals out of Git.
- Commit real accepted milestones with `TNN: concrete change`. No empty/backdated cadence commits, AI co-author trailers or generated-by attribution. Preserve upstream license notices and the explicit old/new source boundary.
- Keep the repository private during this phase. Public release, deployment, spending, posting and submission need their own task authorization; ordinary in-scope local work does not need repeated confirmation.
- After each task, update the ledger with actual command/results and next task. A pending/unknown payment never means unpaid, refundable or safe to resend under a new ID.
