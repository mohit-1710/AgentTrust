# Demo recording plan

**Preparation only, 12 November 2026.** No native paid run or video has been captured. This is a 140-second recording plan, not a transcript of something that happened. Record only after the actual runtime, paid-task and two rehearsal gates pass. The current no-browser instruction remains in force; preparing this document does not authorize opening or recording a browser.

The central question: **Can an agent buy a useful service without choosing its own spending authority?** Show the existing product and one real invoice audit. Do not lead with an architecture diagram, a test count or an award claim.

## The 140-second sequence

| Time | Show | Say, after the evidence exists |
| --- | --- | --- |
| 0–12s | The synthetic CSV and requested audit | “I want this invoice file checked. My agent can buy an audit, but it cannot approve its own suppliers or spending limits.” |
| 12–28s | Owner's actual policy, profile requirement and restricted worker key permissions, all read-only | “The owner sets the budget, exact supplier identities and accepted capability issuer. NEAR restricts the worker key to one contract method.” |
| 28–48s | Actual buyer tool trace for the first provider's missing capability credential; label a preview as a preview | “This provider does not satisfy the required credential. This preview refuses the purchase before the worker submits it.” |
| 48–76s | Actual model selects the separately identified eligible provider; show admission then final settled payment | “The agent chooses an eligible alternative. The contract rechecks every gate and reserves the funds before sending native NEAR. Admission and settlement are separate.” |
| 76–94s | Actual checked report: duplicate group, rejected rows, per-currency totals and matching request hash | “The service verifies the final payment before releasing this report. We separately check the output. These totals include duplicates; they are not amounts to pay.” |
| 94–114s | Separately labeled enforcement test: direct worker submission with a missing/revoked credential, its own payment ID and final contract rejection | “Skipping the SDK preview does not bypass the contract. This direct call is rejected too.” |
| 114–130s | Saved result of the same model buyer job, visibly labeled `recorded_replay`; original job/payment/invoice IDs | “Reopening this job reads its checked result. It makes no new model or payment call. An unknown payment still needs investigation.” |
| 130–140s | Repository/quickstart and a short provenance note | “This is native NEAR testnet with two controlled providers and a project-operated issuer. The UI is reused; the NEAR authority, settlement and service flow are new.” |

The quoted lines are proposed narration. Change them to match the captured result; never change the result to fit the script. If model execution is absent, replace “the agent chooses” with “this scripted scenario selects” and label the demonstration accordingly. That does not satisfy the actual-agent gate.

## Evidence required before recording

- Record the actual source commit, code hash, capture time, public actor identities and original attempt IDs. Use the same captured evidence in the video and proof map.
- Show one successful checked report and one executed contract rejection. Preview alone does not prove mandatory on-chain enforcement.
- Buyer replay must preserve the original job, selected payment ID and invoice hash; it is saved evidence, not a fresh chain observation. Separately retain the T18 native exact-duplicate capture: original T18 invoice, `duplicate:true`, unchanged payment and zero additional payout. A second HTTP response alone does not prove contract idempotency.
- Keep revoked-credential and changed-identity cases in the reproducible evidence package even if the video shows only one. Do not claim an omitted case ran without its capture.
- A pending payment remains pending. Use an actual pending capture if one exists; otherwise explain the rule verbally without fabricating a live row.
- Inspect the completed playback for legible text, correct run IDs and accidental private keys, tokens, personal CSVs or unrelated desktop content. Rehearse twice before the recording.

Use [the local environment](local-demo.md), [runtime runbook](runtime-runbook.md), [verification matrix](sprint/verification.md) and the final paid-task runbook. The invoice sample must be synthetic and the visible totals must come from the checked report, not this script. Do not splice different attempts into an apparent single live transaction. Any edited waiting interval or dated replay should be labeled.

## Recording evidence index

Fill both rehearsal columns only after inspecting the referenced evidence. Replace `Pending` with the actual UTC capture time, result and relative links to reviewed public artifacts; include the identifiers named below. Keep private bundles, buyer configurations, keys and attempt journals out of the published package. A missing or uncertain result stays explicit. Link any edited or replayed clip to its original capture.

| Evidence | Bindings to record | Rehearsal 1 | Rehearsal 2 |
| --- | --- | --- | --- |
| Environment and source | Source commit, production WASM/deployed code hash, core/owner/session, public configuration hash | Pending | Pending |
| Actual buyer choice and payment | Model ID, job/run IDs, nonzero model responses, redacted tool trace, candidate A refusal origin and candidate B payment ID, final transaction/receipt IDs | Pending | Pending |
| Useful checked result | Same buyer payment ID, request/invoice/output hashes, final settled record and checked synthetic report | Pending | Pending |
| Saved buyer replay | Same original job/payment/invoice IDs, replay run ID, `recorded_replay`, `model_responses:0` | Pending | Pending |
| Direct contract refusal | Separate T18 payment ID, expected missing/revoked reason, FINAL transaction/receipt IDs, no payment/payout evidence | Pending | Pending |
| Native exact-duplicate proof | Separate T18 paid ID and original invoice hash, purchase and retry captures, `duplicate:true`, unchanged payment and zero additional payout | Pending | Pending |
| Revocation and identity change | Each distinct T18 attempt ID, actual FINAL reason, referenced state change and no payment/payout evidence | Pending | Pending |
| Runtime and complete rehearsal review | Native manifest/source/artifact binding, unresolved cases, reviewed whole-flow result and remaining visual limitations | Pending | Pending |

For the 114–130s segment, use the original completed buyer bundle with `pnpm demo:operator --directory "$AGENTTRUST_DEMO_DIR" --replay-buyer near-ai`. The command requires an already checked paid job; an unfinished job stops without execution credentials. T18 `--worker retry` uses `demo.payment_ids.paid`, which deliberately differs from the buyer's IDs. Never present that separate contract test as a retry of the buyer purchase or edit the configuration to make the IDs match.

The scripted buyer is an optional deterministic engineering check and can spend native funds when configured. It must remain labeled `scripted_harness_not_autonomous`; it cannot replace the actual-model buyer evidence or either complete rehearsal's fresh actual buyer in the [T18 sequence](testnet-demo-runbook.md#second-rehearsal). Saved replay also does not count as another complete rehearsal. Both full rehearsals use their own prepared environment and new job/attempt IDs, while preserving all earlier evidence.

## Positioning

The distinction is the combination of exact supplier identity, scoped capability requirements and mandatory spending checks in a real service purchase. Do not claim that spending limits, MCP, receipts or retry protection are unique inventions. Do not call conformance a general quality guarantee or testnet activity revenue.

The website is useful for orientation and inspecting facts. The winning evidence must come from the actual task, direct bypass refusal, retry behavior and readable source. A polished screen cannot replace missing native execution.
