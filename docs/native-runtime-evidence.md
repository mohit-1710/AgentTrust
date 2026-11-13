# Native Sandbox evidence — 12 November 2026

**Latest: execution evidence supports 20 of 21 case groups; the native gate remains incomplete.** The broad capture below passes 19 groups. The later [standalone V15 capture](#later-standalone-v15-capture-midnight-and-owner-edits) supplies the midnight/edit proof, and the [clean rerun](#clean-launcher-rerun) completes with outer exit 0. Refund-gap evidence remains open.

Capture `fixed-gas-20261112T163836Z` finished at **16:44:11 UTC** with exit **2**, 116 passing case assertions, no fatal error and no unresolved submission locator. Its `refund_gap` is explicitly `unavailable`; its `midnight_and_edits` is `not_run`. Neither historical status is rewritten by the separate capture.

This is actual execution on a fresh local NEAR Sandbox, separate from the [r2 testnet payments](testnet-r2-evidence.md). It does not establish an actual-model run, either complete rehearsal, browser interaction or submission readiness.

## Source and artifacts

| Item | Recorded value |
| --- | --- |
| Source commit | `78382889f6d6d8cd565184a8b222838458284f21` |
| Working tree | Clean |
| Node / protocol | Sandbox `2.14.0`, protocol `88`; loopback RPC |
| Core account | `core.test.near` |
| Production WASM SHA256 | `f55e07c756bf2b7f3e6c4011dbed49eb0e10048b4d55eccd8f6bba4d829b719f` |
| Callback-fault WASM SHA256 | `3124550f2e24d0a96cc776cf5da23818c2a1d5366459597ac0943eab28c91526` |
| Runtime-helper WASM SHA256 | `9affb1bdab5426d2094be65b12dfcbfb5669723488ac4a5e9d10f1b30a9f2c58` |
| Sandbox binary SHA256 | `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a` |
| Runtime lock SHA256 | `ad8775812b801e7baebc09de4699b0412d31d58856f9ea3217903436c911a20e` |

The retained manifest is:

```text
.sprint/worktrees/t13-runtime-gas/artifacts/local/runtime/fixed-gas-20261112T163836Z/manifest.json
```

Independent read-only review rehashed all **1,038 unique artifacts**, checked all 2,062 global/case references, and inspected the critical receipt graphs and accounting below. The capture contains **360 FINAL transaction responses**, including intentional failing transactions/receipts. The [integrity checker](../scripts/runtime-evidence.ts) returned `status: incomplete`, `current_matrix_covered: true`, `all_cases_reported_passed: false`, exit 2. “Matrix covered” means all required groups are represented, including the two incomplete groups.

The protocol capture records `min_gas_purchase_price: 1000000000` yoctoNEAR/gas. The repaired harness explicitly attaches 300 Tgas at its shared call sites and gives standard restricted keys a finite 0.5 NEAR allowance. This is a fixture gas budget, distinct from purchase limits; the production WASM is unchanged.

## Case results

Counts below are the actual assertions recorded by this capture. They describe the implemented cases, not every possible variation in a verification ID.

| Case group | Result | Passing assertions |
| --- | --- | ---: |
| Initialization authority | Passed | 3 |
| Restricted key | Passed | 8 |
| Actual signer | Passed | 3 |
| Signed dispatch | Passed | 9 |
| Replay/conflict | Passed | 4 |
| Concurrent cap | Passed | 2 |
| Failed transfer | Passed | 6 |
| Private callback | Passed | 2 |
| Withdrawal | Passed | 4 |
| Callback failure | Passed | 6 |
| Session/profile changes | Passed | 6 |
| Exact limits/preview | Passed | 6 |
| Fixed-minute rate | Passed | 5 |
| Trust/identity changes | Passed | 9 |
| Credential changes | Passed | 13 |
| Actor capacity/storage | Passed | 6 |
| Relay predecessor | Passed | 5 |
| Transfer capacity | Passed | 10 |
| Withdrawal failure | Passed | 9 |
| Refund gap | Unavailable | 0 |
| Midnight/edits | Not run | 0 |
| **Total** | **19 passed, 2 incomplete** | **116** |

## Critical observations inspected

- **Successful payment and storage:** `raw/025`–`032` bind a real 0.01 NEAR payout and private callback to the settled payment. The recipient gains exactly 0.01 NEAR and the owner principal falls by the same amount. The payment charges **585 additional storage bytes** at the captured byte price. The dispatch event's actual runtime balance falls by the scheduled principal; the subsequent account query matches the measured storage size and remains above storage stake plus recorded liabilities/reserve.
- **Failed native transfer:** `raw/065`–`070` contain an actual `AccountDoesNotExist` transfer failure to `missing.test.near`, its dependent successful private callback and a final failed payment. Available principal is restored exactly once, pending/outstanding amounts clear, and the exact replay returns the original record without another principal transfer. [NEP-616's description of existing refunds](https://github.com/near/NEPs/blob/master/neps/nep-0616.md#L230-L244) says a failed receipt's refund is independent and need not arrive before its callback. This capture has the refund and callback in the same recorded block; it does **not** prove an intermediate refund-liquidity gap or a second outflow refused during one.
- **Successful and failed withdrawals:** `raw/071`–`076` show a 0.01 NEAR transfer to the fixed owner and an immutable retry. `raw/100`–`124` use the separate helper to delete a local fixture owner before a dependency-linked withdrawal admission. The actual payout then fails because that named account is absent; its real private callback restores principal. Recreating that fixture owner and retrying the original ID preserves the failed record and creates no new principal transfer. Other failed gas-refund receipts in this deleted-account scenario are retained, not hidden.
- **Payout with callback failure:** `raw/969`–`982` deploy the distinct callback-fault artifact. A real 0.01 NEAR payout succeeds, while the callback receipt fails with `RUNTIME_TEST_CALLBACK_FAILURE`. The payment remains pending and principal remains debited. Exact replay does not pay again; advancing time changes only the display to `needs_reconciliation`, without releasing the reservation. This is injected-fault evidence, not a claim about production failure frequency or recovery.
- **Capacity under real payments:** `raw/439`–`968` include **128 separate production settlements of 1 yoctoNEAR**, 128 unique payment IDs, exactly 128 yoctoNEAR of recipient credit/principal debit, and a 129th-payment `CAPACITY` refusal without a record or charge. `raw/983`–`1038` create eight real 1-yoctoNEAR payouts under the callback-fault build, leaving eight pending liabilities. The production code is then restored and its actual code hash checked. Both a ninth payment and an owner withdrawal are refused while all eight reservations remain intact. No balance, payment record or callback outcome is patched.
- **Storage/configuration refusal boundaries:** `raw/395`–`438` show insufficient-storage payment refusal before record allocation, zero-credit actor creation rollback, retained revoked sessions counting toward the eight-session bound, and a fifth-profile refusal. The other actor's storage credit remains unchanged.

Receipt IDs, predecessor/receiver/action bindings, transfer-to-callback data dependencies and before/after values were inspected in the retained raw responses. The separate fault/helper code hashes remain explicit. RPC responses and local SHA256 hashes provide dated execution evidence, not a light-client proof or exhaustive formal verification.

## Preserved failures and remaining work

The original attempts remain unchanged:

- `.sprint/worktrees/runtime-candidate-3/artifacts/local/runtime/candidate-3-20261112T162701Z/manifest.json`: source `24cba9f`, exit 1, HTTP 408 after three passed groups.
- `.sprint/worktrees/t13-runtime-gas/artifacts/local/runtime/gas-repair-20261112T163400Z/manifest.json`: source `a4ee1aa`, exit 1, HTTP 408 after three passed groups. The SDK's `max_gas()` attached 1,000 Tgas; the subsequent repair pins 300 Tgas instead of assuming an SDK maximum.

The accepted observations above belong only to the fresh `7838288` capture; they do not upgrade or rewrite either failed attempt or the frozen candidate. The capture and its raw files remain ignored local evidence.

**Open at this capture:** an observed no-surplus refund gap with its required liquidity refusal, and a real successful callback crossing midnight while owner edits preserve the reservation and original dispatch-day accounting. The later standalone capture below supplies the second proof. Consult the [runtime runbook](runtime-runbook.md) and [verification matrix](sprint/verification.md) for the wider gates.

To repeat only the read-only integrity check from the repository root:

```sh
. scripts/env.sh
node scripts/runtime-evidence.ts .sprint/worktrees/t13-runtime-gas/artifacts/local/runtime/fixed-gas-20261112T163836Z/manifest.json
```

Expected exit: **2**, because the native gate is incomplete. This command does not start a node or perform a chain operation.

## Later standalone V15 capture: midnight and owner edits

**The separate native fixture passed V15; this original outer launcher failed.** Capture `midnight-inclusion-20261112T165320Z` completed at **16:56:04 UTC**, reporting fixture exit 0 and **15 passing assertions**. Independent read-only review verified all **163 unique artifact hashes** and 41 conditions derived directly from the raw receipts, block headers and stored state. This supplies the midnight evidence missing from the historical 19-of-21 capture above; that capture's manifest and results remain unchanged. A later clean launcher result is recorded below.

| Item | Recorded value |
| --- | --- |
| Source / tag | Clean `74828d1335fa283b80116fef3a08d933f8c6e928` / `native-midnight-candidate-1` |
| Fixture binary SHA256 | `109d50cd31eea7151b8612c1c81a21b85ce1b6946f54b5a9a6e53164ffaee2af` |
| Manifest SHA256 | `b80a9d31b20f73fca06ffd22033f1d36ed330197f89112f41dc01cfcf4e39060` |
| Runtime lock SHA256 | `0628a60430bb20bd255c4f68369f5c996064c2358a772903614134bc602e1406` |
| Native controls | Sandbox 2.14.0, protocol 88; installed two-second block delays and epoch length 1,000,000 |

The actual deployed core and Sandbox binary match the production and node hashes recorded above. This fixture uses no callback-fault or helper WASM. Its retained manifest is:

```text
.sprint/worktrees/t13-midnight/artifacts/local/runtime/midnight-inclusion-20261112T165320Z/manifest.json
```

The FINAL transaction and receipt outcomes bind these consecutive canonical block headers:

| Event | Height | Native block timestamp (UTC) |
| --- | ---: | --- |
| Payment transaction inclusion | 12814 | 12 November, 23:59:56.321297 |
| Payment dispatch | 12815 | 12 November, 23:59:58.322022 |
| Owner edit receipt and native payout | 12816 | 13 November, 00:00:00.327270 |
| Private settlement callback | 12817 | 13 November, 00:00:02.330286 |

- The single owner receipt executes `set_policy`, `set_profile`, then `get_account`. Its committed return retains the entire **0.03 NEAR pending**, one outstanding transfer and one payment, even after lowering the daily cap to **0.02 NEAR** and moving the profile to revision 2.
- The exact `actors:v1` plus Borsh owner key was located and decoded independently. Its settled map contains only dispatch day **20769 → 0.03 NEAR**; callback day **20770** is zero. Available principal moves from **1.75 to 1.72 NEAR** and stays there after callback; pending becomes zero.
- A real core-to-merchant `Transfer` pays exactly **0.03 NEAR**. Its output data ID matches the private callback's input, and the recipient balance increases by exactly that amount. Stored invoice/hash and dispatch/finalization timestamps match the original signed request and actual outcomes.
- One native exact replay uses the original request, signature, payment ID and restricted worker key. It returns `duplicate: true` with the identical settled payment; the full ledger and recipient balance remain unchanged, and its receipt graph contains no merchant payout or settlement callback.

The earlier standalone attempts remain failures, without rewriting their artifacts:

- `midnight-20261112T163957Z`, source `30887d1`: four artifacts, HTTP 408 during setup, no midnight assertions.
- `midnight-polling-20261112T164601Z`, source `374a5e5`: 147 artifacts; the callback crossed midnight, but the owner edit committed after settlement. Three of 13 assertions failed and no replay ran.

**Acceptance boundary:** the native V15 evidence is accepted. This original Node launcher subsequently reported a generic failure and remained alive after the fixture finished; it did not establish clean command termination. The separate no-surplus **refund-gap evidence remains open**, so the full native gate is still incomplete. This result also does not establish model execution, two complete rehearsals or browser verification. See the [standalone fixture runbook](runtime-midnight-fixture.md) for its bounded user-run procedure.

## Clean launcher rerun

Capture `midnight-reaped-20261112T171500Z` completed at **17:18:17 UTC** from clean `68bc5a5588743d5ad80ce2edff64f1c3924cc6e5`, tagged `native-midnight-candidate-3`. Both the native fixture and the outer command exited **0**. All **15 native assertions passed** and all **163 artifact hashes matched** in independent review. The production WASM, runtime lock and Rust fixture binary are unchanged from the accepted V15 proof.

| Item | Recorded value |
| --- | --- |
| Manifest SHA256 | `c5ec300a36bab1498d1ec66f2a2a56a67946f1a2c5871832d46d4ee803dccf12` |
| Launcher SHA256 | `515afbe4a099eeda4d99a7c8e1e6e135bef9eb5d0a2d36dc72ddf7a5b118c24d` |
| Dispatch | 12 November, 23:59:58.947779 UTC |
| Committed owner edit | 13 November, 00:00:00.957731 UTC |
| Settlement callback | 13 November, 00:00:02.970032 UTC |

Independent raw review binds canonical blocks 12148–12151, the committed 0.03 NEAR pending balance during the edit, original-day-only accounting, one native payout and the exact replay's unchanged payment, ledger and recipient balance.

The launcher recorded `MIDNIGHT_OWNED_GROUP_OBSERVED_ABSENT_AFTER_EPERM`: after the direct child exited, bounded read-only probes observed the owned group disappear. That terminal observation, not the permission error itself, permits success. A subsequent process inspection found no remaining fixture, Sandbox or launcher. Fourteen isolated process cases and a real owned zombie/reaping test also passed independent review; persistent permission errors and unrelated failures remain nonzero.

The preceding `0a74575` capture, `midnight-cleanup-20261112T170430Z`, remains separately retained: 163 verified hashes, 15 native assertions, fixture exit 0, outer exit **1** with `EPERM`. Its manifest SHA256 is `25ddfd8466a06abaee2858997207968e867e205283d2928d65f10b9e7d19e365`. No earlier capture or outer result was rewritten. This clean rerun closes launcher termination; it does not close refund-gap coverage or either actual-model rehearsal.
