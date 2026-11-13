# Submission preparation

**Draft snapshot, 13 November 2026, 00:37 UTC.** At this checkpoint the repository was private, and nothing had been submitted or posted. The [read-only website and docs](hosting-evidence.md) were live, while paid providers/MCP/buyer remained local. The website's r4 decision feed showed two settled payments and three executed refusals; the docs hosted public [r2](https://docs.agenttrust.tech/verification/testnet-r2), [r3](https://docs.agenttrust.tech/verification/testnet-r3) and [r4](https://docs.agenttrust.tech/verification/testnet-r4) proof pages. Two fresh local-model/MCP operator rehearsals, [r3](testnet-r3-evidence.md) and [r4](testnet-r4-evidence.md), each captured a separate settled 0.002 NEAR purchase, direct refusals, an exact retry and checked output. Native Sandbox evidence supported 20 of 21 case groups; the refund-gap, browser visual QA, video, public source release and submission were open at this checkpoint. See the [ledger](sprint/ledger.md) for later status.

## Intended project and tracks

Project: **AgentTrust on NEAR**. Proposed primary track: `security`, with `agents` as a second track supported by the [r3](testnet-r3-evidence.md) and [r4](testnet-r4-evidence.md) local-model paid-task traces. This is a recommendation for the human's final choice, not a submitted track selection. The frozen scope does not justify adding privacy, swarms, DeFi or business tracks.

The existing repository is [mohit-1710/AgentTrust](https://github.com/mohit-1710/AgentTrust). Its public release is a separate action. The source boundary is `upstream-ui-baseline`; the README links its [comparison with the `hackathon-submission` snapshot](https://github.com/mohit-1710/AgentTrust/compare/upstream-ui-baseline...hackathon-submission) and preserves upstream license notices. The tag fixes the accepted implementation snapshot; the finished video edit source is on main after that tag.

## Description to finalize after verification

> AgentTrust lets an agent buy an invoice-audit service under its owner's spending and supplier rules. A restricted NEAR function-call key can invoke only the payment method. The native contract checks the exact supplier identity, capability credential, limits and signed request before reserving funds and transferring NEAR. In two local-model runs, A received a read-only missing-credential preview; the model then requested the owner-approved B exposed by the host. The host supplied the original payment ID and exact CSV, and B's separate 0.002 NEAR payment settled. The service released its report after final settled-payment verification, and the buyer checked the output separately. The demonstration uses NEAR testnet, synthetic invoices, two controlled providers and a project-operated capability issuer. We reused AgentTrust's website/docs design; the native NEAR contract, SDK, paid HTTP flow and local MCP are new hackathon work.

The [evidence map](evidence-map.md) and two dated rehearsal records support this bounded behavior. The finished video is a local ignored MP4 with a reproducible [source edit](../video/README.md); it still needs the human X post. The final submission also needs public source, selected tracks and a human-confirmed payload. Disclose the open native refund-gap and broader visual-QA limits wherever a complete runtime claim would otherwise be implied.

## X post draft

Publish only after the actual video and public source are ready; the human posts it.

> AgentTrust: Supplier A lacks the audit credential, so preview stops payment. The model asks for host-approved B. Testnet NEAR pays B; a checked invoice report follows.
>
> Built at NEAR HACKATHON. @NEARProtocol #NEARHackathon
> https://github.com/mohit-1710/AgentTrust

Attach the finished demo MP4. This 263-character draft already includes the intended repository URL; verify the repository opens anonymously after the separately authorized public release. This is a draft, not permission to publish.

## Release and submission requirements

The [official event instructions](https://nearhackathon.com/HACKATHON.md), rechecked on 12 November UTC, still set the deadline to **14 November 23:59 UTC / 15 November 05:29 IST**. Existing-product ports and testnet entries are eligible when new work is identified. A local-only demo needs public source, reproducible instructions and a video. The repository must remain public through judging and include a LICENSE file. The human decides the final payload and publishes the X post with @NEARProtocol and #NEARHackathon. Submit the project once; if a saved submission has a mistake, the human uses [Request changes](https://nearhackathon.com/request-changes) instead of submitting again. Re-read the live instructions at final review.

The final payload cannot be completed from repository metadata. Obtain the human-confirmed lead name, contact email, team-size option, selected tracks, mainnet prize account, public demo-post URL and contact consent. Project name and repository URL also need confirmation in the exact payload. Never invent a wallet, infer consent or commit personal submission data. Keep any eventual payload outside Git.

Read the contact notice verbatim when collecting consent: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."

Generate one `requestId` when preparing the final payload, retain it outside Git and reuse it for any permitted retry. An uncertain response must not trigger a second submission with a new ID. No request ID has been generated by this draft.

Before requesting final approval, assemble the concrete video, README, source diff, evidence map and complete payload. Public release, posting, submission, deployment and spending each retain their separate authorization boundary. A missing native result remains visible in the package; it cannot be replaced by mock-only tests.
