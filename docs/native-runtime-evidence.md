# Native Sandbox evidence — 12 November 2026

**19 of 21 case groups passed; the native gate remains incomplete.** Capture `fixed-gas-20261112T163836Z` finished at **16:44:11 UTC** with exit **2**, 116 passing case assertions, no fatal error and no unresolved submission locator. `refund_gap` is explicitly `unavailable`; `midnight_and_edits` is `not_run`. Neither is counted as passed.

This is actual execution on a fresh local NEAR Sandbox, separate from the [r2 testnet payments](testnet-r2-evidence.md). It does not establish an actual-model run, either complete rehearsal, browser interaction or submission readiness.

## Source and artifacts

| Item | Recorded value |
| --- | --- |
| Source commit | `79917e2502266322df0e65099db75c0415b503e0` |
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
- **Failed native transfer:** `raw/065`–`070` contain an actual `AccountDoesNotExist` transfer failure to `missing.test.near`, its dependent successful private callback and a final failed payment. Available principal is restored exactly once, pending/outstanding amounts clear, and the exact replay returns the original record without another principal transfer. These final observations do **not** prove an intermediate refund-liquidity gap.
- **Successful and failed withdrawals:** `raw/071`–`076` show a 0.01 NEAR transfer to the fixed owner and an immutable retry. `raw/100`–`124` use the separate helper to delete a local fixture owner before a dependency-linked withdrawal admission. The actual payout then fails because that named account is absent; its real private callback restores principal. Recreating that fixture owner and retrying the original ID preserves the failed record and creates no new principal transfer. Other failed gas-refund receipts in this deleted-account scenario are retained, not hidden.
- **Payout with callback failure:** `raw/969`–`982` deploy the distinct callback-fault artifact. A real 0.01 NEAR payout succeeds, while the callback receipt fails with `RUNTIME_TEST_CALLBACK_FAILURE`. The payment remains pending and principal remains debited. Exact replay does not pay again; advancing time changes only the display to `needs_reconciliation`, without releasing the reservation. This is injected-fault evidence, not a claim about production failure frequency or recovery.
- **Capacity under real payments:** `raw/439`–`968` include **128 separate production settlements of 1 yoctoNEAR**, 128 unique payment IDs, exactly 128 yoctoNEAR of recipient credit/principal debit, and a 129th-payment `CAPACITY` refusal without a record or charge. `raw/983`–`1038` create eight real 1-yoctoNEAR payouts under the callback-fault build, leaving eight pending liabilities. The production code is then restored and its actual code hash checked. Both a ninth payment and an owner withdrawal are refused while all eight reservations remain intact. No balance, payment record or callback outcome is patched.
- **Storage/configuration refusal boundaries:** `raw/395`–`438` show insufficient-storage payment refusal before record allocation, zero-credit actor creation rollback, retained revoked sessions counting toward the eight-session bound, and a fifth-profile refusal. The other actor's storage credit remains unchanged.

Receipt IDs, predecessor/receiver/action bindings, transfer-to-callback data dependencies and before/after values were inspected in the retained raw responses. The separate fault/helper code hashes remain explicit. RPC responses and local SHA256 hashes provide dated execution evidence, not a light-client proof or exhaustive formal verification.

## Preserved failures and remaining work

The original attempts remain unchanged:

- `.sprint/worktrees/runtime-candidate-3/artifacts/local/runtime/candidate-3-20261112T162701Z/manifest.json`: source `ca49c19`, exit 1, HTTP 408 after three passed groups.
- `.sprint/worktrees/t13-runtime-gas/artifacts/local/runtime/gas-repair-20261112T163400Z/manifest.json`: source `9f5b05a`, exit 1, HTTP 408 after three passed groups. The SDK's `max_gas()` attached 1,000 Tgas; the subsequent repair pins 300 Tgas instead of assuming an SDK maximum.

The accepted observations above belong only to the fresh `79917e2` capture; they do not upgrade or rewrite either failed attempt or the frozen candidate. The capture and its raw files remain ignored local evidence.

**Still open:** an observed no-surplus refund gap with its required liquidity refusal, and a real successful callback crossing midnight while owner edits preserve the reservation and original dispatch-day accounting. Separate fixtures need their own successful captures and review; preparation does not close these cases. Consult the [runtime runbook](runtime-runbook.md) and [verification matrix](sprint/verification.md) for the wider gates.

To repeat only the read-only integrity check from the repository root:

```sh
. scripts/env.sh
node scripts/runtime-evidence.ts .sprint/worktrees/t13-runtime-gas/artifacts/local/runtime/fixed-gas-20261112T163836Z/manifest.json
```

Expected exit: **2**, because the native gate is incomplete. This command does not start a node or perform a chain operation.
