# Current field and strongest defensible AgentTrust strategy

As of 11 November 2026 IST. This is a competitive source review and proposed build/demo strategy, not a forecast of prizes or evidence of customer demand. Canonical feature scope lives in [09-feature-spec.md](09-feature-spec.md); this document supplies field evidence and strategic recommendations. No competitor code was executed, no tests were run, and no chain transactions, database writes, outreach, posts, or submissions were made.

## What changed the strategy

A restricted-key vault with caps, allowlists, approval queues, a red refusal screen, and receipts already has close peers in this event. Even a full agent loop that negotiates, pays for data, verifies delivery, produces a report, and exposes MCP tools is already present in Allowance's source. Those are necessary product behaviors, not a safe novelty claim.

AgentTrust should make a narrower promise: **an agent can buy a useful service only from the exact provider identity, payout, and capability scope its owner authorized; changing that identity or invalidating its credential stops the payment, while a qualified alternative lets the job finish.** The owner session profile locks the required capability scope, so the worker cannot omit a credential requirement by relabeling the job. Deterministic budget controls remain mandatory. Settlement evidence stays factual; do not invent a trust score, reputation economy, or permissionless quality claim merely to look different.

## Field snapshot and limits

Read-only enumeration of `https://nearhackathon.com/api/projects?page=N` returned 62 pages, 494 rows, and **494 unique project IDs**. All pages advertised `total: 494`. Saved raw snapshot: `competition-snapshot-2026-11-11.json`; its fetch timestamp is the authoritative observation time. This is a consistent pagination observation, not a transactional snapshot of a frozen competition.

237 entries selected `security`; 226 selected `agents`. Tags overlap and are self-selected. These counts do **not** mean 237 implemented competing vaults, say anything about quality, or estimate winning odds. The API provides names, tags, and demo URLs, but no source repository field. Six plausible close projects were found through public repository discovery and inspected below. Names collide: the directory contains multiple Leash, Allowance, AgentGuard, and Veto entries; do not merge entrants by name. The later Veto by 0xdopewilly is distinct from the directory's earliest Veto entry.

## Six close projects: claims and actual inspected code

Source pins were taken from each shallow clone's HEAD. Public deployment/test statements below remain author claims unless specifically stated as source observations; live transactions were not independently replayed.

| Project / source pin | What the author claims | What static inspection establishes | Strategic implication |
| --- | --- | --- | --- |
| [Allowance](https://github.com/soldanoandrea/allowance), `74edffec98cbeffd88d31223802f088c2d0f10b8` | Key-only agents, native/FT treasury, policy simulation, approval, counterparty risk, seller receipts, MCP, counteroffers, deliverable checks | `pay`, policy versions, callbacks, exact request-hash receipt verification, and one-shot paying-agent delivery confirmation exist. Its scripted loop purchases datasets and builds a report. | Neither adaptive HTTP402 purchasing nor receipts/MCP are unique advantages. Strongest reference peer for end-to-end reproducibility. |
| [Veto](https://github.com/0xdopewilly/veto), `095d8fa424059880f014719afb49935b0c99d14a` | Private attested screening, prompt-injection and changed-wallet prevention, proof inspection, NEAR/MPC/OutLayer/Agent API routes | `submit_verdict` checks the guardian, approved model signer, deadline, exact proposal ID/hash, then executes or vetoes. Source includes quote signature and EVM transaction construction. | A generic claim of cryptographic proofs or payment spoof defense is also crowded. Avoid matching its whole integration stack in four days. |
| [Semilla1 Guard](https://github.com/semilla1lab/semilla1-guard-near), `d45f369c1ff99fc184f0063b69f34de2c2317f14` | Native-NEAR guard, function-call key, rolling cap, cooldown, allowlist, testnet evidence | `agent_spend` implements these checks and records authorized-agent decisions. It schedules a native transfer and returns acceptance; documentation notes failed transfers still consume budget. | Simple caps and a stolen-key attack are table stakes. AgentTrust should clearly distinguish approval from settled payment. |
| [NEAR Agent Spend Guard](https://github.com/mubudot/near-agent-spend-guard), `a8a72abfbbc6611193bad68909e6ab3111949199` | Multi-agent policies, owner threshold, bounded audit, read-only dashboard, scripted/optional LLM modes | `spend` reserves daily spend/liquidity, queues threshold payments, and `approve` reevaluates current policy. Source handles generation/day context for asynchronous callbacks. | Current-policy rechecks, reservations, and callback correctness matter more than a long feature list. Basic owner approvals are not a new edge. |
| [Leash](https://github.com/hycorange/near-leash), `fc0ad7772728f16f948e2010a342e23789b41fff` | Restricted vault, shared evidence blocklist, off-chain risk checker, first-payee review, dashboard | Registry stores reporter/reason/evidence URL; flags use curator confirmation or a reporter threshold. Checker contains account/code/history/lookalike rules; vault calls registry. | Shared risk/blocklists already exist. Counting reporters is not proof of unique people; avoid adding a similar crowd-score system. |
| [LeashPay](https://github.com/hassaanraja282-lgtm/leashpay), `b84d728275b20f024356b679e3adbd67575ba2da` | Testnet dashboard, agent chat, caps, allowlist, approval queue, protocol-bypass buttons | `request_payment` returns typed outcomes and appends audit entries; callback records failed transfers. Owner controls and key restrictions are represented in code. | A polished dashboard plus pay/deny/approve buttons does not by itself separate AgentTrust. Its user-visible lifecycle must be precise. |

Decisive exact source locators:

- Allowance [seller-side receipt verification](https://github.com/soldanoandrea/allowance/blob/74edffec98cbeffd88d31223802f088c2d0f10b8/src/lib.rs#L1142-L1166), [delivery confirmation](https://github.com/soldanoandrea/allowance/blob/74edffec98cbeffd88d31223802f088c2d0f10b8/src/lib.rs#L1034-L1058), and [paid task/report loop](https://github.com/soldanoandrea/allowance/blob/74edffec98cbeffd88d31223802f088c2d0f10b8/sdk/examples/agent-loop.ts#L39-L115).
- Veto [enclave-signed proposal verdict checks](https://github.com/0xdopewilly/veto/blob/095d8fa424059880f014719afb49935b0c99d14a/contract/src/lib.rs#L550-L614) and [signature envelope](https://github.com/0xdopewilly/veto/blob/095d8fa424059880f014719afb49935b0c99d14a/contract/src/verdict.rs#L1-L70).
- Semilla1 [accepted native transfer and audit behavior](https://github.com/semilla1lab/semilla1-guard-near/blob/d45f369c1ff99fc184f0063b69f34de2c2317f14/contract/src/lib.rs#L88-L100).
- Spend Guard [reservation and approval flow](https://github.com/mubudot/near-agent-spend-guard/blob/a8a72abfbbc6611193bad68909e6ab3111949199/src/lib.rs#L145-L194).
- Leash [report/curator registry](https://github.com/hycorange/near-leash/blob/fc0ad7772728f16f948e2010a342e23789b41fff/contracts/registry/src/lib.rs#L64-L112), [flag decision](https://github.com/hycorange/near-leash/blob/fc0ad7772728f16f948e2010a342e23789b41fff/contracts/registry/src/lib.rs#L167-L177), and [checker rules](https://github.com/hycorange/near-leash/blob/fc0ad7772728f16f948e2010a342e23789b41fff/checker/src/score.ts#L13-L71).
- LeashPay [payment outcome](https://github.com/hassaanraja282-lgtm/leashpay/blob/b84d728275b20f024356b679e3adbd67575ba2da/contract/src/lib.rs#L159-L204) and [transfer callback](https://github.com/hassaanraja282-lgtm/leashpay/blob/b84d728275b20f024356b679e3adbd67575ba2da/contract/src/lib.rs#L302-L318).

## Exact scope to distinguish, without a first/unique claim

The inspected paths do not establish the following integrated service-provider model. That is a bounded source-review result, not proof that all 494 entries lack it.

| AgentTrust proof | Why it is useful | What not to claim |
| --- | --- | --- |
| Service ID binds endpoint, payout account, and identity version | A seller cannot quietly change payment destination behind an approved service name | Display name or registration alone proves an honest seller |
| A policy requiring a capability checks an approved issuer, exact scope, subject identity/version, expiry, and revocation | A valid credential for another service, version, or task is rejected | A demo issuer proves universal competence or quality |
| A one-off approval binds one exact request and is rechecked at execution | Owner approval for one operation cannot be reused for another or override hard gates | A human approval makes forged or revoked evidence valid |
| Every transport reaches the same contract checks | Bypassing SDK/MCP preflight does not escape spending or identity checks | HTTP/MCP enforcement alone is on-chain security |
| Receipt records payment lifecycle separately from output verification | Judges can see what was authorized, actually paid, and checked | Payment proves delivery, correctness, or customer satisfaction |

Allowance already binds receipts to a seller request and records policy versions; Veto already binds a signed verdict to an exact proposal and screens changed wallets. AgentTrust's proposed distinction is the **specific service identity/capability authorization model integrated with the mandatory spend path**, not generic request binding or signature checking. It is acceptable if the benefit is demonstrated rigorously rather than claimed to be unprecedented.

## A concrete paid service whose output is useful and checkable

Recommended demonstration: **invoice-CSV structural audit**, capability scope `invoice.audit.v1`.

A user gives the buyer agent a vendor-invoice export and a small budget: “Find duplicate invoice IDs, malformed amounts/currencies, and per-currency totals, using an approved audit service.” The service returns canonical structured JSON with the input SHA-256, parsed row count, duplicate-ID groups, rejected row numbers/reasons, and exact decimal totals grouped by currency. The app displays a concise findings table and downloadable report. This is a real transformation of user-supplied input, not a canned “payment succeeded” response.

Use a public, synthetic fixture for recording, with known duplicates and malformed rows. A deterministic local checker recomputes the expected outputs from the same bytes. The provider can be a small separate HTTP service; useful work does not require an LLM in its implementation. The buyer agent makes the choice and follows typed results. The gateway verifies request/response binding and actually receives the HTTP output; the contract cannot observe HTTP calls, prove endpoint liveness, or certify report quality. A fixed scripted policy path must be labeled as such; if an LLM selects among providers, record the actual call and decision while keeping all payment authority in deterministic code.

The validator credential means only: “this endpoint/version passed the named invoice.audit.v1 conformance suite at this time.” Show issuer, suite hash/version, timestamp, and expiry. Output verification is a separate client check. This does not certify general financial accuracy, detect whether an invoice reflects a real purchase, establish external customer demand, or turn a testnet transfer into revenue.

The validator first obtains a fresh challenge-signed identity descriptor from the pinned HTTPS endpoint and checks its registered service ID/version, invoice key and payout, with no cross-origin redirects. Testing public output alone must not let another registrant claim that endpoint. The owner profile pins the accepted suite/schema; credential fields separately identify that suite and the evidence manifest for the actual run. Each worker session has exactly one owner-selected profile ID/revision; giving the worker another weaker session would undermine that restriction.

Freeze `invoice.audit.v1` semantics before issuing a credential: UTF-8 CSV with a documented quoted-field/newline grammar; required columns `vendor_id`, `invoice_id`, `amount`, `currency`; case-sensitive IDs after documented outer-whitespace trimming; duplicate key `(vendor_id, invoice_id)`; explicit supported currencies for this demo; signed base-10 amounts with at most two fractional digits and no exponent/grouping notation; exact decimal/integer arithmetic, never floating point. Report rows that fail schema/amount/currency parsing and exclude them from totals. Totals include every valid row, including flagged duplicates, and are labeled that way; they are not an amount to pay. Use a data-row index that remains unambiguous when a quoted field spans physical lines.

Commit golden fixtures covering a normal file, duplicate IDs across same versus different vendors, quoted separators/newlines, malformed/blank amounts, negative credit amounts, and unsupported currencies. Commit their manually checked expected results. The service and verifier should not merely call the same parser and label agreement independent validation. Even separate implementations plus fixtures establish a bounded conformance check, not universal financial correctness.

A short demo can use two providers plus forged evidence variants:

- Provider A is inexpensive but presents an invalid, expired, or wrong-scope credential. The buyer receives a precise denial, with no payment.
- Provider B has the required owner-approved identity/payout and a currently valid, explicitly trusted demonstration credential. The buyer buys its audit, waits for settlement, verifies the result, and presents the anomalies.
- Revoke B's credential or change its payout/identity version, then attempt a **new purchase with a new payment ID** using stale evidence or permission. It is blocked despite being within budget. A retry of an already-dispatched historical payment instead returns its recorded state without paying again; it is not reevaluated as a new purchase. Approving a changed service identity does not repair a revoked required credential.

Do not show a dozen contrived vendors. Two providers and controlled attack variants keep the causal explanation legible. If provider alternatives are seeded, label them as controlled demo services. If an independent provider is later integrated, record that evidence separately.

## Strongest demo and proof package

Aim for a 120–150 second public demo, plus one deeper interactive evidence view. Preserve the user's requested AgentTrust visual identity and docs layout.

1. **0–15 s: user intent.** Show the input invoice rows, requested audit capability, approved provider identities, and budget. One sentence: the agent must finish the task without authority to pay a substituted supplier.
2. **15–40 s: supplier evidence fails.** A cheap quote carries wrong-scope/expired evidence. Show the contract's exact typed rejection, no merchant payout and no monetary-cap consumption; a rejected transaction can still cost gas. The agent chooses the qualified alternative.
3. **40–75 s: useful work completes.** Show confirmed settlement, the real returned report, its verified input hash and anomaly table. The user sees the useful result, not only wallet plumbing.
4. **75–105 s: mutate a critical fact.** Change payout/version or revoke the credential, then attempt a new purchase with the old service permission/evidence. The contract rejects it. Show that extra allowance cannot silently rescue invalid identity evidence. If the optional approval flow is present, a previously approved but not yet dispatched request must also fail the current checks.
5. **105–130 s: bypass/replay proof.** One direct contract request using the worker key still fails; retrying an already settled operation does not pay again. End on the final output, total spent, and evidence links.

The proof panel should expose operation ID, service identity/version, quote/request digest, capability issuer/scope/validity, policy version, decision code, dispatch/settlement state, and output check status. Link to RPC/explorer evidence. Unknown or pending outcomes must stay pending. A hash by itself is not verification: the checker should show which exact bytes or contract fields were compared.

README proof map: feature → source method → one reproduction command → expected observable result → relevant transaction/receipt. Include explicit baseline/fork disclosure and a new-NEAR diff. State that seeded credentials and controlled services are demonstrations. Separate tests actually run, tests merely present in source, and live interactions. No invented proof count or copied Solana Kani badge.

## Track fit and NEAR-specific explanation

Select `security` primarily and `agents` if the paid-service task completes. The [official security prompt](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/06-security.md) explicitly suggests counterparty checks, restricted keys, and an attack demonstration. That explains fit but also why many projects resemble each other. The [Agent Economy prompt](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/07-agents.md) requests a contractor agent with a budget, buying work/data, checking it, and recording receipts. The proposed procurement loop demonstrates that purpose without adding unrelated systems.

NEAR's role should be concrete: a function-call key constrains the worker's available methods; the contract holds the funded authority and enforces all mandatory gates; named provider identities and service versions are readable; asynchronous dispatch/settlement is reconciled honestly. Cross-chain routing is a later route, not a requirement. Do not add `privacy`, `business`, `swarms`, or `defi` merely because those themes can be mentioned. Add a track only for a working behavior a judge can reproduce.

## Four-day cut order

The observed clock was 11 November, early IST, leaving approximately four days to the deadline **15 November 2026, 05:29 IST** (14 November, 23:59 UTC). This schedule is proposed, not a claim of current implementation progress.

| Day | Finish | Verification gate |
| --- | --- | --- |
| Nov 11 | Native core: restricted authority, exact service/payout/version, policy, conditional credential checks, operation IDs and lifecycle | Direct bypass, spoofed subject/scope/issuer, revocation, hard-cap and replay checks pass; settled versus pending is visible |
| Nov 12 | SDK/MCP/custom HTTP adapter and the invoice audit service; typed rejection to alternative provider | Full useful job completes with real output, deterministic verification, and no transport bypass |
| Nov 13 | Existing UI/docs wired to real NEAR state, evidence panel and reproducible quickstart; exact one-off approval only if the core is already green | Fresh setup following only README works; failure and delayed-callback paths produce correct balances and labels |
| Nov 14 | Freeze features by 12:00 IST, repair only; record by evening; prepare public source/diff and exact final payload | Rehearse twice, inspect final video/form; target submission review by 23:30 IST, leaving almost six hours before the official deadline |

If exact one-off approval cannot be made safe on time, ship strict unattended denial and require the owner to update the relevant authorized profile for a fresh operation. Never let approval override identity/credential/hard-budget gates.

Cut first: synthesized reputation scores; staking/slashing; crowdsourced accusation markets; full marketplace; TEE runtime; MPC/cross-chain routes; Intents mainnet; multiple FTs; factory convenience; analytics dashboards; natural-language policy parser; extra MCP tools. Keep one payment asset/rail until the core passes.

Never cut: mandatory on-chain gates, exact identity/payout binding, idempotency, lifecycle correctness, useful paid output, provenance labels, reproducibility, or the baseline disclosure. If the build slips, reduce the demo to one service capability and two controlled providers. A smaller evidenced loop is preferable to claiming half-integrated cross-chain or quality systems.

## Current event requirements and strategy limits

The [live HACKATHON.md](https://nearhackathon.com/HACKATHON.md), reread this session, still permits an existing other-chain product when the new NEAR work is isolated/disclosed (Q-002–005), allows testnet entries and optional integrations (Q-010–011), and requires public source plus a public X demo and one final submission. Existing UI reuse is eligible; the new backend behavior needs to earn the technical case. Machine screening checks reproducibility/features; humans decide awards (Q-017). No numeric judging weights or winning probability were found.

This review did not watch competitor X videos, exercise hosted flows, validate their public transactions, or audit every code path. Claims of live availability, tests passing, security effectiveness, and adoption remain unverified here. The six source snapshots are enough to reject shallow uniqueness claims and set a concrete proof bar; they are not a competition ranking or proof of an empty market niche. Recheck the directory/rules before freezing the submission, since entrants and requirements can change.
