# T02 toolchain and safe command record

Verified on 11 November 2026 on macOS arm64. This is a local compilation/toolchain result, not a deployed contract or runtime acceptance result.

## Pins

| Component | Exact version |
|---|---|
| Node / pnpm | 24.22.2 / 10.33.0 |
| Rust / WASM target | 1.97.1 / wasm32-unknown-unknown |
| Contract SDK / account ID | near-sdk 5.30.1 / near-account-id 3.0.0 |
| Pure serialization / hashing | borsh 1.8.1, serde 1.0.229, sha2 0.10.9 |
| TypeScript / Vitest / Node types | 6.0.3 / 5.1.0 / 24.19.2 |
| Native JS client | near-api-js 7.4.0 |
| Existing surfaces | Next 16.2.4; web React/DOM 19.2.4; docs React/DOM 19.2.5 |

`Cargo.lock` and `pnpm-lock.yaml` pin transitive dependencies. Root scoped pnpm overrides keep docs React/DOM at the planned 19.2.5; the imported docs manifests remain byte-identical. Other inherited manifest ranges are resolved in the lockfile without a source rewrite. Surface compatibility and visual checks remain T21–T25.

`near-workspaces 0.24.0` is the **Rust crate**, not an npm package. It is not installed or included in the default workspace. T13 must isolate its user-run runtime harness and avoid its default Sandbox-install feature when preparing dependencies.

## Local setup and reproduction

From the repository root, every new shell can use:

```sh
. scripts/env.sh
node --version
pnpm --version
cargo --version
pnpm install --frozen-lockfile --ignore-scripts
pnpm check:fast
pnpm build:contract
```

`scripts/env.sh` prepends ignored project tools when present; otherwise it uses normally installed tools. It does not install anything. On another machine, install the exact Node/pnpm pins and Rust toolchain before these commands. Rustup honors `rust-toolchain.toml`.

This machine had working `/opt/homebrew/bin/rustup` but broken global Cargo proxies. Only ignored project-local wrappers were created; no global proxy was repaired. Exact preparation performed:

```sh
/opt/homebrew/bin/rustup toolchain install 1.97.1 --profile minimal \
  --component rustfmt --component clippy --target wasm32-unknown-unknown
mkdir -p .agenttrust/tools/downloads .agenttrust/tools/bin
curl --fail --location https://nodejs.org/dist/v24.22.2/node-v24.22.2-darwin-arm64.tar.gz \
  --output .agenttrust/tools/downloads/node-v24.22.2-darwin-arm64.tar.gz
```

The archive's SHA-256 was checked **before extraction** against `aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a`, from the [official checksum file](https://nodejs.org/dist/v24.22.2/SHASUMS256.txt). After that verification:

```sh
tar -xzf .agenttrust/tools/downloads/node-v24.22.2-darwin-arm64.tar.gz -C .agenttrust/tools
ln -s node-v24.22.2-darwin-arm64 .agenttrust/tools/node
PATH="$PWD/.agenttrust/tools/node/bin:$PATH" .agenttrust/tools/node/bin/npm install \
  --prefix .agenttrust/tools/pnpm --ignore-scripts --no-audit --no-fund pnpm@10.33.0
ln -s ../pnpm/node_modules/pnpm/bin/pnpm.cjs .agenttrust/tools/bin/pnpm
```

The local executable wrappers for `cargo`, `rustc`, `rustdoc`, `rustfmt`, `cargo-fmt`, `cargo-clippy` and `clippy-driver` each contain `exec /opt/homebrew/bin/rustup run 1.97.1 <tool> "$@"`. This machine-specific workaround stays ignored; normal working Rustup proxies need no wrapper. The initial missing `rustdoc` proxy was corrected before the final passing suite.

## Effects and verification boundary

- `.npmrc` disables install lifecycles and implicit pre/post scripts. The inherited Fumadocs postinstall and generators were not executed. T25 owns explicitly reviewed generator commands.
- Default Cargo members contain only the pure domain crate. No `near-sdk` unit-testing feature, Sandbox, database, chain RPC, funding or deployment is part of default checks.
- Vitest includes only the designated unit-test paths, excluding runtime/live folders. Typechecking currently covers native packages/examples/unit tests; it does not claim the imported web/docs compile.
- `build:contract` compiles locally, then reads the WASM imports/exports without instantiating it. [near-sdk 5.30.1](https://docs.rs/near-sdk/5.30.1/src/near_sdk/lib.rs.html) requires `cfg(near)` for its NEAR host path; `.cargo/config.toml` sets this only for the WASM target. A generic WASM compilation without this setting is not sufficient.
- `build:surfaces`, `test:ui`, `verify:runtime`, `demo:prepare:testnet`, `demo:run:testnet` and `evidence:check` currently fail explicitly with exit 2 and name their owning task. They do not simulate successful checks. Replace them only when those tasks supply reviewed implementations.

## Actual checks

| Command/check | Observed result |
|---|---|
| `pnpm install --frozen-lockfile --ignore-scripts` | Lockfile current, no lifecycle scripts run |
| `cargo fmt --all -- --check` | Exit 0 |
| `pnpm check:fast` | 1 pure Rust test, 0 doctests, 2 TS tests passed; native TS typecheck passed |
| `pnpm build:contract` | Exit 0; 13,733-byte WASM |
| Artifact inspection | Imports `env.current_account_id`, `env.read_register`, `env.register_len`, `env.value_return`, `env.panic_utf8`; exports `current_account`, metadata and memory |
| `pnpm verify:runtime` | Expected exit 2, unimplemented message; no runtime started |
| Installed surface versions | web React/DOM 19.2.4; docs React/DOM 19.2.5 |

The one contract export is a read-only build probe, not payment functionality. T05 replaces it with the native ABI and updates the expected export check. The TS byte hash was independently calculated with Python `hashlib`; the other TS test loads the pinned NEAR client and round-trips a public key offline. No keys were generated, no transaction was signed, and no contract was deployed or executed.
