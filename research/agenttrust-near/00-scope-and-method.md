# AgentTrust on NEAR: scope and evidence

Research dates: 10–11 November 2026. Research only; no product implementation or chain transactions were performed.

## The requested outcome

Adapt [AgentTrust](https://agenttrust.tech/) and [its public repository](https://github.com/agenttrust-labs/agenttrust) to native NEAR while preserving its existing website and documentation design. Study NEAR first, then use actual AgentTrust implementation details to recommend what to retain, replace, add, and defer. “Docx page” is interpreted as the existing documentation website.

The product choice is settled by the user's current instruction. Earlier idea rankings in this workspace's memory are historical context, not the current decision. The workspace itself was empty apart from `.claude/` when inspected; old research files mentioned in memory were not available here and were not treated as fresh evidence.

Follow-up scope: decide the actual payment gates and trust/facilitator-list semantics, including what to remove, add and change; then design the strongest credible hackathon positioning and demonstration against current entries. [09](09-feature-spec.md) is the resulting canonical feature recommendation and [10](10-competitive-strategy.md) is the competition/demo study. No implementation was requested in these follow-ups.

## Evidence baseline

- Source repository fetched read-only into `.reference/agenttrust/`.
- Pinned revision: `21a3b111b7677d0b06ab1b063d647e4f52ea3b17`.
- Commit timestamp: `2026-05-31T15:15:00+05:30`; subject: `web: bump Kani stats to 7/7 · 662 sub-checks`.
- This is the GitHub default branch snapshot fetched on the research date, not proof of deployed bytecode equivalence or operational correctness.
- Live official NEAR documentation, standards, ecosystem documentation, public registry metadata, and read-only RPC/API responses are used for current protocol and integration facts.
- Static inspection of code is distinguished from running it. No dependencies were installed and no fetched application code, test suite, seed script, or deployment script was executed.

## X verification requested by the user

The `x-recon` skill's login check passed once for its default dummy account. The following read-only scrape was run from the skill directory:

```sh
.venv/bin/python scripts/x_thread_scrape.py 'https://x.com/NEARProtocol/status/2112257967818997891' --max-replies 15
```

It returned one original post and no accessible top replies. Capture time: `2026-11-10T13:24:57.659928+00:00`. The post is an X Article: the ordinary tweet `text` field was empty, but the article body and outbound links appeared in `card_context`. That is an extraction distinction, not an empty announcement. The article timestamp is `2026-10-19T19:01:58Z`.

[The announcement](https://x.com/NEARProtocol/status/2112257967818997891) describes the November 1–14 event, intelligent agents and programmable money, a public repository and X demo, and NEAR tools as choices rather than a mandatory checklist. Current event FAQ/rules take precedence where they clarify or update the article. No conclusions rely on engagement counts or inaccessible replies.

The scraper's original JSON remains in its local ignored cache; no cookies or private account material were copied into this study.

## Questions investigated

1. Which NEAR execution guarantees differ from Solana's transaction/CPI model?
2. How do NEAR access keys constrain an autonomous spender, and which authority must the contract still enforce?
3. What do native NEAR, NEP-141 tokens, Intents, and Chain Signatures each require for safe settlement?
4. What do AgentTrust's contracts, SDK, facilitator, MCP, UI, and docs actually implement at the pinned revision?
5. Where do product claims exceed the specific implemented or verified path?
6. What replaces Quantu identity/reputation and ATOM data without fabricating trust?
7. What can retain the exact visual design, and which technical content must change?
8. What is a defensible hackathon scope, build order, demo, and verification bar?

## How conclusions are qualified

- **Observed:** inspected code, fetched public response, or exact current documentation.
- **Recommendation:** a proposed architecture or scope inferred from those observations.
- **Unverified:** execution, compatibility, deployment, security, or performance not exercised in this research.

Parallel contributors investigated NEAR core, AgentTrust source, and NEAR ecosystem/event requirements. The coordinator inspected UI/docs and integrated the findings. A model review is a consistency check, not independent empirical validation or a security audit certification.

## Access and action boundary

Read-only web, Git clone, source inspection, public HTTP GETs, and read-only NEAR RPC calls were used. Files written are local research artifacts. No registration, submission, X posting, Slack contact, purchase, database write, AWS mutation, Terraform operation, funding, signing request, or blockchain deployment was part of the study.

## Search and inspection record

The meaningful batches were the requested X Article; current event homepage and `HACKATHON.md`; pinned AgentTrust source and live docs; NEAR protocol/contract/security/access-key docs and NEPs; live read-only network and package registry metadata; Intents/Chain Signatures docs; Agent Market docs/OpenAPI/public reputation and discovery endpoints. Each topical report contains the decisive URLs and inspection limits. This was a focused engineering investigation, not a systematic literature review or an exhaustive ecosystem census.

The 11 November follow-up additionally traced existing gate/list/caller semantics, enumerated 494 stable project IDs from the public event directory across 62 pages, and statically inspected six close public repositories at pinned commits. That pagination is a dated directory observation, not an audit of all entrants. Competitor programs, tests and hosted payment flows were not executed; their videos were not independently assessed. See 10 and its saved snapshot for coverage and exact evidence.
