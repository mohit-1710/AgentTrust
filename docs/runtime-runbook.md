# Native runtime evidence

**Preparation status:** the harness compiles; it has not been executed by the agent. No native runtime gate has passed. This is a local Sandbox experiment, not testnet deployment or payment evidence.

The standing database restriction applies to Sandbox because it persists a chain database. The user must run the commands below. Do not invoke them through an agent, CI, scheduled job or a default test/build hook. Ordinary `pnpm check:fast` and `pnpm check:runtime:compile` do not start Sandbox.

## Compile and inspect first

From the repository root:

```sh
. scripts/env.sh
pnpm check:fast
pnpm build:contract
pnpm check:runtime:compile
```

The runtime package is its own Cargo workspace and lockfile. `near-workspaces = 0.24.0` enables only `rustls`; its `install`, `interop_sdk` and `unstable` features are off. Resolved `near-sandbox = 0.4.0` has an empty build script. The runtime feature graph contains no `near-sdk` unit-testing/VM, RocksDB or SQLite package. Harness verification uses `cargo check`, never `cargo run` or the Sandbox launcher. The one explicitly named pure target, `cargo test --locked --manifest-path tests/runtime/Cargo.toml --test rpc_rejections`, constructs error enums/JSON only and is safe to run; it never invokes the harness or Sandbox. No wildcard runtime tests are authorized. Local crypto/TLS/compiler build scripts do not call an AWS service despite the `aws-lc` library name.

Do not use `--all-features` or enable default near-workspaces features. Its install feature can download a Sandbox binary during compilation. The runtime launcher requires an existing executable absolute path and sets `NEAR_SANDBOX_BIN_PATH`; it does not install one. Obtain a compatible official nearcore Sandbox binary separately and retain its release checksum. The harness records the exact executable SHA-256 and node-reported version. A nearcore version supporting `tx_status` and `wait_until: FINAL` is required; 2.14 is the inspected API baseline.

For deterministic callback-failure evidence, build and inspect the alternate WASM separately:

```sh
cargo build --locked --target wasm32-unknown-unknown --release \
  -p agenttrust-core --features runtime-test-callback-failure \
  --target-dir target/runtime-fault
node scripts/check-wasm.mjs \
  target/runtime-fault/wasm32-unknown-unknown/release/agenttrust_core.wasm \
  --runtime-test-callback-failure
```

This default-off artifact panics in the payment callback after authorization/lookup and before writes. It must never overwrite or be presented as the production artifact. There is no production fault endpoint, admin resolver or refund shortcut. The runner hashes both files, refuses identical hashes, observes the deployed code hash, and labels injected-failure evidence.

## Separate relay/deleted-owner fixture

The optional helper is a separate Cargo workspace and WASM, with no production/core dependency or modification. Its only exports forward a payment through another predecessor and schedule a real owner deletion before a dependent withdrawal. Build and inspect it without execution:

```sh
cargo build --locked --manifest-path tests/runtime-helper/Cargo.toml \
  --target wasm32-unknown-unknown --release --target-dir target/runtime-helper
node scripts/check-runtime-helper.mjs \
  target/runtime-helper/wasm32-unknown-unknown/release/agenttrust_runtime_helper.wasm
```

The inspector validates exports/host imports and the `AGENTTRUST_RUNTIME_HELPER_ONLY` marker without instantiating WASM. Keep its hash/path separate from both production and callback-fault artifacts. Only the user-run harness deploys it, onto fresh isolated relay/owner accounts. It never replaces the core. No test helper endpoint belongs in a production wallet, agent or MCP environment.

## User-run command

Review `scripts/run-runtime.mjs`, `tests/runtime/src/` and `tests/runtime-helper/src/lib.rs`, then run this command yourself with the actual binary path:

```sh
. scripts/env.sh
pnpm verify:runtime -- --user-run \
  --sandbox-bin /absolute/path/to/near-sandbox \
  --fault-wasm target/runtime-fault/wasm32-unknown-unknown/release/agenttrust_core.wasm \
  --helper-wasm target/runtime-helper/wasm32-unknown-unknown/release/agenttrust_runtime_helper.wasm \
  --output artifacts/local/runtime/first-inspected-run
```

Omit `--fault-wasm` to run the production cases only; `callback_failure` and `transfer_capacity` will stay `not_run`. The output directory must be new and inside ignored `artifacts/local/runtime/`; captures are never overwritten. The process creates a temporary local Sandbox chain, synthetic accounts and ephemeral random keys. It does not load a wallet credential directory, use testnet funds, deploy remotely or run a provider. Only public account IDs, public-key fingerprints, quotes, transaction/receipt data and observations are captured. No worker/owner/merchant secret is written to the evidence.

The runner reads the production artifact from `target/wasm32-unknown-unknown/release/agenttrust_core.wasm` by default. Use `--wasm` only for another reviewed production artifact. The manifest captures actual `rustc --version` and `cargo --version` output under `toolchain.measured`, labels NEAR/Rust dependency values as `configured_pins`, and hashes the resolved runtime lockfile. Configured pins are not presented as measurements of the executable or WASM. The manifest includes source commit and dirty-tree status; for a reproducible acceptance capture, run from the accepted clean commit. The binary hash is authoritative for the exact bytes deployed, and a commit identifier alone does not prove a locally built artifact matches source.

## What each case actually asserts

| Case | Observations captured |
|---|---|
| `initialization_authority` | Foreign first caller fails; the contract account initializes; deployed code hash matches production WASM. |
| `restricted_key` | Actual on-chain access key has exact receiver, singleton `execute_payment` and finite allowance. Owner-method, other-receiver, deposit, native transfer and key-management attempts yield access-key errors. A transport error does not count. |
| `actual_signer` | Full-access owner key different from registered worker key and a different signing account cannot allocate the quoted operation. |
| `session_and_profile_changes` | Real worker calls after session revocation/expiry reject without record, debit or usage changes. Zero-deposit owner management fails; a worker cannot select another profile, preserve an obsolete profile revision or self-upgrade its session revision. |
| `exact_limits_and_preview` | Three allowed previews leave actor state and payment allocation untouched. Purchase cap +1 yocto rejects; the exact purchase/day cap settles; day cap +1 rejects; exact replay charges no new attempt. |
| `fixed_minute_rate` | Six actual worker keys under one owner submit requests. Five must settle and the sixth must receive `RATE_LIMIT`. All six initial core execution receipts, including the rejected request, are bound to captured block hashes/timestamps and must share one minute; accepted dispatch timestamps must match that minute. The recorded owner attempt count is five and replay does not change it. A window crossing fails this scenario rather than silently weakening the assertion. |
| `trust_and_identity_changes` | Owner service/payout blocks override active trust; inactive trust has no trial path; endpoint/version, signing-key and payout changes invalidate the old exact approval. A fresh exact owner approval restores a valid dispatch. |
| `credential_changes` | Missing, unaccepted issuer, wrong subject/suite, old revision, revoked and expired references cannot dispatch. Unsupported scope issuance and empty issuer profiles reject without creating their records. A current accepted assertion settles; its later revocation preserves the entire original payment across exact replay, with no recipient balance increase or actor accounting change. |
| `actor_capacity_and_storage` | Observed insufficient unused storage credit rejects payment without allocation. Another actor's credit stays unchanged; zero-credit actor creation rolls back. Revoked sessions count toward eight retained sessions and a fifth profile is rejected. |
| `signed_dispatch` | Mutated signed amount rejects. Exact canonical invoice/hash settles; payee receives the exact native amount. Successful receipt-local event reports the actual before/after scheduling balance and paired backing inputs. Final serialized storage equals priced dispatch storage; final account backing holds. |
| `replay_conflict` | Identical quote returns duplicate with the same record and no payout; changed immutable tuple under the same ID conflicts before signature re-evaluation. |
| `concurrent_cap` | Two real protocol keys/sessions under one owner broadcast 0.03 NEAR requests under a 0.05 daily cap; only one retained payment is admitted. |
| `failed_transfer` | Native transfer to a nonexistent named account fails; record becomes failed, available claim is restored once, attempt remains consumed, no pending/outstanding liability remains, exact retry cannot restore again. |
| `private_callback` | Foreign predecessor cannot invoke the callback or change a terminal record. Pure transition tests cover repeated/opposite finalization; this runner does not manufacture an original callback receipt. |
| `withdrawal` | Direct owner withdraws available money, fixed owner destination is retained, final state is succeeded, duplicate ID debits no second amount. Owner balance also pays gas, so its net delta alone is not the payout proof. |
| `callback_failure` | Separately hashed injected build pays the recipient but fails callback, keeps the reservation pending/debited, and does not repay on exact retry. Observed Sandbox clock advancement produces only `needs_reconciliation`, with no fund release. |
| `refund_gap` | **Unavailable in this runner.** A final failed transaction does not prove rejection during a real intermediate no-surplus refund gap. |
| `midnight_and_edits` | **Not run by this runner.** Pure original-day accounting tests do not prove a delayed native callback crossing midnight. |
| `relay_predecessor` | Optional separately hashed helper forwards an otherwise allowed quote with the correct owner/session signing key. Actual core receipt payload proves foreign predecessor, unchanged arguments and zero deposit; core must return `UNAUTHORIZED`, with no allocation, accounting change or payout. |
| `transfer_capacity` | An isolated owner settles 128 real 1-yocto production payments; the 129th rejects without allocation or charge. Another owner makes eight actual payouts under the separately hashed callback-failure build, retaining eight pending liabilities. The runner restores and code-hash checks production WASM before the ninth payment and owner withdrawal must both reject `CAPACITY` without changing reservations. |
| `withdrawal_failure` | Optional helper schedules real owner `DeleteAccount` before a dependent owner-authorized core withdrawal. Captured receipt dependencies/context prove pending admission, actual payout failure to the absent named owner and successful private restoration. Committed receipt events prove exact debit/restoration. Recreating that isolated account and retrying the same ID must preserve the complete failed record and accounting, with no further principal transfer. |

The [pinned nearcore source analysis](runtime-refund-order.md) explains why receipt generation order does not rule out the refund gap; it is not a runtime reproduction.

The harness deliberately exits **2 (incomplete)** while any required case remains unresolved, even when all implemented cases pass. Exit 1 means a failed assertion/fatal setup or execution error; exit 0 requires every required case to report passed. Do not delete missing cases or replace them with passing assertions to make the command green. Schema v2 makes the expanded scenarios explicit. Omitting the helper leaves relay/withdrawal-failure cases `not_run`; their claimed pass requires its distinct hash. Refund-gap and delayed-midnight callback cases remain open even with every optional artifact present. Cases cover the particular observations listed above, not every possible variant in a verification ID. In particular, service trust expiry, service-version credential invalidation, all registry/trust bounds and an actual pending liability across policy edits remain further matrix work. Preparation is not completion of G2/G3.

## Read the recorded evidence

```sh
pnpm evidence:check artifacts/local/runtime/first-inspected-run/manifest.json
```

The checker is read-only. It verifies schema, required case presence, consistent statuses/exit code, exact local artifact hashes, contained paths, explicit FINAL transaction responses, transaction/outcome identity, final-query request metadata, exact execution-block request/hash/timestamp metadata, receipt-payload IDs and absence of common secret-bearing fields. It labels output `recorded_capture` with the original UTC timestamp. `capture_status` preserves the manifest's consistent reported result. `all_cases_reported_passed` is true only for a schema-v2 capture with the complete current case set and every case reported passed; it is **not an independent verification that its assertions are true**. Schema-v1 captures remain readable with their original timestamp and status, but `current_matrix_covered` is false, missing new cases are listed, and the checker cannot return current completion for them. Review the referenced raw public RPC artifacts before accepting any gate. Hash integrity is not a blockchain/light-client proof or tamper-proof authorship; the RPC server and capture process remain trust assumptions.

The capacity fixture funds 4 NEAR of storage credit plus 1 NEAR principal, installs a finite 1 NEAR worker gas allowance and explicitly sets a 256-per-minute owner rate so rate exhaustion does not mask the 128-record boundary. These are isolated fixture settings, not product defaults. Its pending fixture uses a separate owner from the one-payment callback-failure case. Omitting the fault artifact leaves `transfer_capacity` incomplete, even if production records were captured.

Scenario accounts are independent except for intentionally shared owner sessions in the rate and concurrent-cap cases. Session/credential expiry uses user-run Sandbox clock acceleration followed by a measured final block timestamp; it does not infer elapsed time from block count. The pinned `near-workspaces` fast-forward API advances height/time and explicitly does not accelerate in-flight transactions. It provides no receipt pause/release control, so it cannot by itself prove a callback was delayed across midnight. No state patch or manually invoked callback is used to substitute for that evidence.

Every admitted payment/management transaction is submitted asynchronously, retaining its transaction hash and signing account. The five intentionally invalid protocol-key probes use `transact()` solely to obtain a typed `RpcTransactionError`: the pinned async RPC has an empty error enum and may lose rejection details during parsing. The probe follows the actual error source chain, downcasts the concrete JSON-RPC error, and accepts only the expected `InvalidAccessKeyError` variant. Transport/parser failures, nonce/signature errors, missing keys, arbitrary matching text and any returned execution result cannot pass a restriction assertion. Captures retain the typed context and source chain; legacy synchronous results never prove settlement. The recorder calls raw `tx_status` with `wait_until: FINAL`, requires the response to say `FINAL`, and saves all receipt outcomes. Legacy `broadcast_tx_commit`, `TransactionStatus.status()` (which requests INCLUDED), HTTP 200 and a transaction hash are not accepted as settled evidence. Receipt outcome IDs are labeled receipt IDs, not transaction hashes. Read snapshots preserve the actual `finality: final` query and response block hash/height.

Helper scenarios additionally preserve `EXPERIMENTAL_receipt` request/response payloads for the outcome IDs, requiring matching receipt ID and executor. Signer/key, predecessor, action arguments and input/output dependency IDs are read from those real native receipts. Unknown/missing receipt payloads stop the scenario rather than becoming success evidence.

Only NEP-297 logs attached to successful receipts from the core account are used as committed observations. A panic can leave logs in an outcome while rolling back state; those logs cannot prove a persisted denial/finalization. Inspect failure details alongside payout balances and the final immutable contract record. FINAL includes refund completion, so final snapshots cannot reconstruct intermediate refund ordering.

Keep unreviewed evidence ignored. After inspecting the capture, report its path, commit, artifact hashes, case results, gaps and relevant receipt IDs to the agent for read-only review. Explicitly stage only reviewed public artifacts later. No credential directory, private key, user CSV or environment dump belongs in a capture or Git.

Sources: [NEAR transaction RPC finality](https://docs.near.org/api/rpc/transactions), [near-workspaces 0.24.0 source](https://github.com/near/near-workspaces-rs/tree/d2e8efc8785d12562db5a58a8ba142e1e559a921), [near-sandbox source](https://github.com/near/near-sandbox-rs/tree/56e17cd309bcf98645d306bca80dbeca3bab33c9).
