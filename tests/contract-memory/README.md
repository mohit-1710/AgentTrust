# Contract memory-host checks

This isolated workspace compiles the unchanged production contract Rust source as a library. It calls actual `AgentTrustCore` methods through NEAR SDK 5.30.1 host functions backed by an ordinary Rust `HashMap`; promised actions are recorded in a `Vec`. No database, Sandbox, node, remote RPC, wallet, or browser is started. Test keys are deterministic public fixtures and must never be used for deployment or funds.

Run explicitly from the repository root:

```sh
cargo test --manifest-path tests/contract-memory/Cargo.toml --test host_contract --locked --offline
```

The first run needs the locked crate dependencies in Cargo's local cache. Dependency fetches and compiler output are ordinary files. This workspace has its own lock and target directory. It is deliberately absent from the production workspace; do not add `near-sdk/unit-testing` to production dependencies.

The checks reload root/collection state from serialized host storage between method calls and cover measured storage-credit charges, actual Ed25519 signature verification, persisted payment retry, host worker-key and backing rejection, exact transfer/callback action fields, payment callback success/failure/idempotency and private-context/result validation, and owner withdrawal accounting. Expected-panic tests discard their host; they assert the adapter aborts without claiming rollback.

## Evidence boundary

These tests execute native Rust methods, not production WASM or generated JSON entrypoint wrappers. Context identities, balances, timestamps and promise results are test-supplied. They do not prove key permissions, transaction validation, atomic receipt rollback, transfer execution, asynchronous scheduling, refund ordering, real gas consumption or live settlement. A recorded transfer action is not a transfer. A failed result is supplied by the test, not observed from a chain. T13 native-runtime acceptance remains open.

The initial resolved dependency audit found no database engine or WASM runtime; `near-vm-runner` 0.38.1 has no enabled features. Its host functions and ordinary-map mock match the inspected published 0.38.0 source byte for byte. Build scripts perform compiler/platform probes, generated source and bundled local cryptography/compression builds. Re-audit dependencies and build effects before changing the lock.

Validation: 24 tests passed, 0 failed, 0 ignored; formatting and unchanged production-source/manifest checks passed. No production defect was reproduced by these cases.

The nine supplemental registry/limit tests cover issuer storage charges; credential revocation, renewal and issuer-scoped IDs; exact subject/version/suite/reference binding; identity rotation and renewed owner trust; inactive trust versus immutable retry; preview under the host's read-only mode; seven payments across sibling sessions plus one withdrawal consuming the eight-transfer limit; and exact purchase/daily caps versus one yocto over. Preview allow/deny/validation results leave persisted account views, root bytes, storage size, registry records, payment index, logs and promised actions unchanged.
