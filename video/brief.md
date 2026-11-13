# AgentTrust NEAR video brief

**Audience:** NEAR hackathon judges seeing the product for the first time, then developers checking proof. **Format:** 1920×1080, 30 fps, H.264/AAC MP4, 125–130 seconds, readable on a phone. **Opening:** flash forward to the A preview refusal, B settlement and checked report before product mechanics. **Goal:** show one recorded model-requested purchase through a useful checked result, then a separate executed direct A refusal and one exact direct retry without a second provider payout.

The [official event instructions](https://nearhackathon.com/HACKATHON.md) require a video for local-only demos, a public reproducible repo, and a human X demo post. They do not prescribe length or voice. [X's non-Premium cap](https://help.x.com/en/using-x/x-videos) is 140 seconds and 512 MB, so retain margin. The [AgentTrust Labs pinned post](https://x.com/agenttrustlabs/status/2054278036120637541) supplies the concise risk-first voice, but its old Solana claims do not carry over. The [NEARCON winner obrigado.cc submission](https://devpost.com/software/obrigado) uses a short task-to-payout walkthrough; this is an example, not a scoring rule.

## Evidence boundary

- **Main run:** public [r4 proof](https://docs.agenttrust.tech/verification/testnet-r4), saved local model `qwen3:4b-instruct`, run `02b59dad-9e6a-47c9-a524-681869bab00b`. Five recorded model responses requested `get_policy`, `list_services`, `get_service(A)`, `pay_service(A)`, then `pay_service(B)`. The trace is a self-recorded allowlisted extract. Raw prompts/responses were not retained. `pay_service` offered the currently host-allowed supplier; the model did not choose arbitrary supplier identities, payment IDs, or CSV content.
- **A in main run:** SDK preview `MISSING`, with no chain transaction. **B in main run:** separate payment ID `ZIu51ge1LUZIwCdlrfb/OgFivcWwI9NXeUUN5DJJaHo=`, [final transaction](https://testnet.nearblocks.io/txns/EAmDNch3Qi9LLeD2cSxp93oC5NAFD6N8SWzFT3eNGfSF), transfer receipt `HS3fQWFtctwcgdByLTRPvW3uASJScrVzGu2WJ7QSaX5j`, 0.002 NEAR, checked 15-row synthetic report (8 accepted, 7 rejected, duplicate group). Report totals include duplicates and are not payable totals.
- **Separate direct refusal:** [r4-16](https://testnet.nearblocks.io/txns/9HXLnfY5nmcLy9nWsc61HpdkskCTaw3qn5vyTBm1GQWD) executed `MISSING`, with no payment or provider payout. A final NEAR transaction may still consume gas when the contract refuses.
- **Separate exact retry:** [r4-18](https://testnet.nearblocks.io/txns/4E6XwrwGAN7YepiQZ7HV3VjRQn7Ux7B5WUKcBWfFVYet) used the **direct purchase** r4-17 ID `vhPJvvHknVMmUgubm5XQdwvcTHyaVgF5zoNZSJBCniU=`, returned `duplicate:true`, and sent no second provider payout. It is not a retry of the model purchase.
- The [live decisions page](https://www.agenttrust.tech/decisions) combines read-only final payment views with referenced executed transaction outcomes; it does not show model activity. Pair it with the r4 proof for the model transaction. The website/docs are public; the model, MCP and paid providers ran locally. The issuer and both providers were project-operated. Native refund ordering remains an unverified runtime case. The repository is still private until separately authorized for public release.

## Editorial rules

Use the existing white/ink/violet AgentTrust design, large text, fixed subtitles and source labels. Every proof card carries its run or attempt label. A visible transition separates the model run from direct-call tests. Show the actual product site and documentation, then enlarge/crop real captured evidence for mobile legibility. Curated evidence cards reproduce checked allowlisted fields and link the exact public source; they are graphics, not live UI footage. The public synthetic CSV fixture may show row 9 and duplicate invoice A-100 beside the checked result. No raw `.agenttrust` files, keys, tokens, personal data, or invented model dialogue appear on screen. The 8-second website hero loop is visual material only.

Audio must have public-use rights before export. The provided ElevenLabs key checked as free tier; [ElevenLabs limits free output to non-commercial use with attribution](https://elevenlabs.io/docs/overview/administration/billing), so this promotional video uses the locally generated [Apache-2.0 Kokoro model](https://huggingface.co/hexgrad/Kokoro-82M) unless a paid commercial license is separately in place before generation. No purchased credits or live-chain calls are needed for this edit.

## Completion checks

1. Match voice to picture and fixed subtitles; verify the useful audit result, model B purchase, separate executed A refusal and separate exact retry are unmistakable.
2. Decode the whole MP4; check 1920×1080/30 fps/H.264/AAC, duration below 140 seconds, file below 512 MB, first 10 seconds, scene boundaries and final frame.
3. Inspect at phone scale for legibility, subtitle timing, distinct attempt labels, receipts, provenance and accidental secrets. Have independent first-time-judge and technical-judge reviews; repair their concrete findings.
4. Commit the reviewed T29 package and push private. X posting and official submission remain separate actions.
