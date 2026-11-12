# Separate midnight and owner-edit fixture

This binary prepares one bounded V15 experiment. It is separate from `agenttrust-runtime`, uses the unchanged production WASM, and does not replace the general runtime matrix. Compilation and pure tests do not establish a pass.

Pinned near-sandbox 0.4.0 starts a fresh local 2.14.0 node with two-second minimum/maximum block delays and a one-million-block epoch. Near-workspaces 0.24.0 attaches using its RPC address and validator home directory. The fixture captures installed settings, node/protocol, source commit, lock hash, WASM hash and node binary hash.

Genesis time is not treated as a virtual-clock setter. Nearcore uses wall time plus the Sandbox fast-forward offset. After all setup transactions are FINAL, the fixture advances toward the next UTC midnight and checks actual optimistic block timestamps. No fast-forward runs after payment submission. No state patch, fault WASM, callback call, recipient helper or receipt scheduling API is used.

The scenario submits one 0.03 NEAR payment with its real restricted key shortly before midnight. On the first exact transaction `INCLUDED` response, it immediately submits one owner batch:

1. Lower the daily cap to 0.02 NEAR.
2. Increment the selected profile revision.
3. Call the existing `get_account` method and return its ledger.

The batch's committed return must still show the sole retained payment's entire 0.03 NEAR pending principal, one outstanding transfer and the original principal debit. This establishes that both edits happened before settlement. If edit and callback share a block, identical timestamps alone establish no order: the pending ledger returned by the successful edit receipt supplies that proof. Otherwise captured block timestamps must place the edit between dispatch and callback. RPC array position never supplies ordering.

Acceptance also requires:

- Actual successful dispatch and private callback timestamps cross UTC midnight; stored payment timestamps and dispatch day match those blocks.
- A real native Transfer receipt binds the payout amount/recipient to the callback's input-data dependency.
- Final pending is zero, principal remains debited and today's settled usage is zero. A read-only `view_state` capture decodes the unique owner `ActorState` with the production domain schema and verifies exactly 0.03 NEAR in the original dispatch-day bucket.
- Both edits remain committed. Recipient balance increases by exactly 0.03 NEAR, without other recipient transactions during measurement.
- One exact replay after the edits preserves the complete payment, persisted ledger and recipient balance. Runtime vault cash is excluded from ledger equality because contract gas rewards can change it.

Transaction inclusion is only a scheduling signal; the RPC may initially return `INCLUDED` without an outcome body. The final transaction outcome must subsequently bind the original hash/signer to the dispatch receipt, and its inclusion block must match the canonical block at that height and be covered by the final head. Inclusion alone does not prove that the edit preceded settlement. Acceptance still requires the committed edit return to retain the full pending principal and relies on FINAL transaction/receipt data.

Every transaction locator is saved before finality polling. The fixture queries `tx_status` with `wait_until: NONE` so the node's ten-second server wait cannot end a slow-block observation; only a response reporting actual `FINAL` passes. It retains the first status and each changed response and polls only the original locator for at most 90 seconds. The status loop never resends. A typed, matching `UNKNOWN_TRANSACTION` remains unresolved; other RPC errors fail. HTTP errors retain their status and exact response bytes, including nearcore's HTTP 408 timeout body.

## Bounds and failures

There is one timing attempt, one payment and at most one exact replay. The overall wall limit is 900 seconds. Setup funds three fresh local accounts with 20 NEAR each; the worker key has a finite 1 NEAR gas allowance and both worker calls explicitly attach 150 Tgas. These are isolated fixture budgets, not product defaults. The fixture never uses near-workspaces' changing `max_gas` default.

The checked-in Node launcher requires the exact `.node-version` before spawning anything and owns the fixed fixture binary and Sandbox in one POSIX process group. Persistent SIGINT/SIGTERM handlers, the outer 900-second timer and early child exit all trigger group SIGTERM, followed by SIGKILL after at most two seconds. Only PATH, TMPDIR and the explicit Sandbox path/command annotation reach the fixture; wallet/model keys, HOME and NODE_OPTIONS are dropped. Abrupt interruption can leave an incomplete capture, which must never be accepted as a pass.

Group-signal or probe errors are launcher failures. Cleanup always clears its timers and signal listeners, even when a group operation throws. Abort/escalation callback errors reach the same failure path. On a group error, it attempts SIGKILL only on its direct child and releases an unresolved child handle so the launcher can report failure. Output retains a sanitized error code, an allowlisted error class when the code is unknown, and an explicit warning that descendant cleanup is unconfirmed; a failed kill never becomes a successful cleanup claim. The retained Rust manifest and launcher exit status are separate evidence.

A skipped launch window, no inclusion observation within 20 seconds, first observation beyond `INCLUDED`, edit after settlement, same-day callback, timeout, malformed evidence or failed assertion records failure. It never silently advances another day or creates another payment. Keep that capture; another explicitly selected trial needs a new output directory and node. Slow blocks provide observation time, not guaranteed receipt order.

The first execution, `midnight-20261112T163957Z`, stopped during the first account-creation status wait with HTTP 408. Its original four artifacts and failed manifest remain unchanged; it proves no payment or midnight behavior. The polling repair and pure tests require a fresh separately executed capture before any V15 acceptance.

The second execution, `midnight-polling-20261112T164601Z`, crossed midnight and charged the original day exactly once, but its edit receipt followed the callback by one block and returned zero pending principal. The three affected assertions correctly failed and no replay ran. Its 147 artifacts and failed manifest remain unchanged. Waiting for contract pending state had delayed the edit submission; the inclusion trigger is a new scheduling attempt, not a pass claim. Future ordering metadata states the required proof and separately records whether the committed return actually retains full pending funds.

The third execution, `midnight-inclusion-20261112T165320Z` at `719b5ed`, retained 163 artifacts and passed all 15 native assertions. Its pinned Node24 launcher then reported a cleanup failure and remained alive after the Rust fixture and Sandbox were gone; root stopped the owned launcher, yielding outer exit137. The original error code was discarded, so its precise cause remains unknown. An ordinary-process regression reproduced the timer leak by injecting a group-signal error after child exit. The repair passed that case, abort/escalation failures, denied group/direct-child kills with an explicit unconfirmed-cleanup result, and compiled Rust exit stubs. No additional native run validated this launcher repair; the original passed manifest and nonzero outer status remain unchanged.

## Exact commands

Safe compile/pure checks, without a node:

```sh
. scripts/env.sh
cargo check --locked --manifest-path tests/runtime/Cargo.toml --bin agenttrust-midnight
cargo test --locked --manifest-path tests/runtime/Cargo.toml --test midnight_evidence
cargo build --locked --manifest-path tests/runtime/Cargo.toml --bin agenttrust-midnight
node scripts/test-midnight-launcher.mjs
```

Only when actual local runtime/database execution is authorized for this work:

```sh
. scripts/env.sh
node scripts/run-midnight.mjs --user-run --sandbox-bin /absolute/pinned/near-sandbox --wasm /absolute/production/agenttrust_core.wasm --output /absolute/repository/artifacts/local/runtime/NEW-midnight-capture
```

An existing absolute node path is required; there is no download fallback. The launcher runs only `tests/runtime/target/debug/agenttrust-midnight`, so compile that target first. Retain failed captures. `manifest.json` uses the distinct `agenttrust_midnight_fixture` format; the general runtime-evidence checker does not accept it. Independently review its assertions, hashes and referenced receipt/block/state artifacts before accepting V15. Do not rewrite an earlier matrix manifest or count this standalone fixture as completing refund-gap coverage. The launcher regression copies the script into a fake temporary repository and exercises only ordinary-file stub descendants, including one that ignores SIGTERM; it never runs the real fixture or Sandbox.

Supported hooks: [near-sandbox configuration](https://github.com/near/near-sandbox-rs/blob/56e17cd309bcf98645d306bca80dbeca3bab33c9/src/config.rs), [near-workspaces builder](https://github.com/near/near-workspaces-rs/blob/d2e8efc8785d12562db5a58a8ba142e1e559a921/src/network/builder.rs). Clock semantics: [Sandbox offset](https://github.com/near/nearcore/blob/2.14.0/chain/client/src/client.rs#L1766), [block timestamp construction](https://github.com/near/nearcore/blob/2.14.0/core/primitives/src/block.rs#L215).
