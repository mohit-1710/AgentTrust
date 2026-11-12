# Prepare the accounts for one testnet demo

This helper fills the prerequisite before the [T18 runbook](testnet-demo-runbook.md): one fresh testnet parent and five separate role accounts. **The operational commands are user-run only.** Offline preparation creates local key files and public configuration; it does not contact a faucet, RPC, model or browser. Compiling or testing this helper does not establish a native payment, runtime gate, model run or successful rehearsal.

Use one fresh bundle for one environment/rehearsal. The helper does not deploy the contract, initialize balances inside AgentTrust, register providers, install the worker key, issue credentials or run a purchase. Those remain the explicit T18 steps. Keep the two providers' own accounts as their payouts and the parent idle as the later rotated payout.

## Fixed funding and authority

The parent name is `agenttrust-<24 random hex characters>.testnet`. Its children are `core`, `owner`, `issuer`, `service-a` and `service-b` under that parent. Every account has its own independent Ed25519 full-access key. The additional worker key belongs to the owner account only after T18 installs its restricted function-call permission; bootstrap never installs it. Each provider also has a separate invoice-signing seed.

| Recipient | Initial allocation |
| --- | ---: |
| Core | 6 testnet NEAR |
| Owner | 2 testnet NEAR |
| Issuer | 0.5 testnet NEAR |
| Provider A | 0.5 testnet NEAR |
| Provider B | 0.5 testnet NEAR |
| Total | 9.5 testnet NEAR |

Before the first allocation, the parent must have **at least 10 NEAR gross balance**, no stake, no contract and the prepared full-access key. Before each child, the helper checks final available balance minus its conservative storage reserve against all remaining allocations plus a fixed `0.1 NEAR` gas margin. It does not mistakenly require 10 NEAR again after sending 6 NEAR to core. This is a fixed provisioning budget, not a measured cost guarantee; the current production artifact, protocol storage cost and actual balances are checked. Underfunding stops before signing. There is no top-up, mainnet or arbitrary-account option.

The account names and keys cannot be supplied to redirect funding. Existing names are refused before new funding; the helper does not adopt an unrelated account. A child transaction has exactly `CreateAccount`, its fixed transfer and its prepared full-access key. It requests `FINAL` once and checks the exact finalized signer/key/receiver/actions plus the resulting account/key. The parent relationship alone does not grant authority over a child's independent key. See NEAR's [account creation documentation](https://docs.near.org/protocol/tutorials/creating-implicit-and-named-accounts) and [storage costs](https://docs.near.org/protocol/storage/storage-staking).

## Offline preparation

Run from the accepted checkout with the pinned tools. Choose a new ignored directory; its parent must already exist. No CLI option can select another WASM: preparation inspects `target/wasm32-unknown-unknown/release/agenttrust_core.wasm`, checks the production host imports/exports and rejects both the runtime-fault and helper markers. Its actual SHA-256 is bound into the bundle. Later operations recheck the same artifact, so an intervening rebuild with different bytes stops provisioning.

```sh
. scripts/env.sh
export AGENTTRUST_DEMO_DIR="$PWD/.agenttrust/testnet-demo-1"
(
  set -eu
  umask 077
  mkdir -p "$PWD/.agenttrust"
  pnpm build:contract
  pnpm build:services
  node dist/examples/testnet-demo/src/bootstrap.js --prepare --directory "$AGENTTRUST_DEMO_DIR"
)
```

The directory is created exclusively with mode `0700`; every file has mode `0600`. Repeating preparation, even after interruption, refuses to reuse or overwrite it. Preparation prints only its public status and directory. It ignores shell wallet/model credentials. Keep the directory private and outside Git, recordings and shared captures. Do not print its secret files or paste their values into command arguments.

Files are separated as follows:

| File | Contents |
| --- | --- |
| `bootstrap.json` | Public parent, role public keys, invoice public keys, fixed testnet endpoints, WASM hash and demo hash |
| `demo.json` | Public T18 configuration, actual role/worker identities, fresh session/credential/payment IDs and 24-hour expiries |
| `provider-a.json`, `provider-b.json`, `mcp.json` | Existing provider/MCP configuration with fixed localhost origins and TLS path placeholders |
| `secrets/parent.json`, `core.json`, `owner.json`, `issuer.json`, `provider-a.json`, `provider-b.json`, `worker.json` | Separate NEAR key records, all under `secrets/` |
| `secrets/provider-a-invoice.json`, `secrets/provider-b-invoice.json` | Separate invoice seed records |
| `operations/<step>.json` | Immutable intent and, for child creation, the transaction locator recorded before sending |
| `evidence/<step>-<random>.json` | Public observation/result records; no credentials |

A NEAR key record is `{schema_version: 1, role, account_id, public_key, private_key}`. A provider invoice record is `{schema_version: 1, role, public_key, seed_base64}`, where `public_key` is raw 32-byte Ed25519 in canonical base64. `loadBootstrapBundle(directory)` validates every secret-to-public binding, role, independent key, file permission and generated configuration without constructing a provider/signer or doing network work. It is an internal loader, not an instruction to print its returned object.

The fixed provider origins are `https://localhost:4041` and `https://localhost:4042`; both charge `0.002 NEAR`. Before starting providers, follow [local TLS setup](local-demo.md#https-for-the-two-local-providers) and replace only their absolute `tls.cert_file` and `tls.key_file` paths. No system/browser trust-store changes are required. Other public configuration edits invalidate this bundle. New faucet/creation steps refuse expired session or credential configuration before any POST/signing; expired bundles still load and their saved operations can still be observed. Prepare close to the rehearsal so the generated 24-hour session/credential expiries remain usable; do not rewrite IDs or extend expiry after operations begin.

## User-run provisioning, one step at a time

No account or service credential is required for the helper's published faucet request. It uses only the newly generated parent public key. The private parent key is used locally for the five later child transactions, never sent to the helper.

First, explicitly request the parent once:

```sh
node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step faucet
```

Inspect the returned evidence file. On a successful helper response followed by final account/full-access-key observation, this step reports `created`. A successful HTTP response alone is insufficient. The helper response body is never printed or stored. Any ambiguous result reports `uncertain`, exits `2` and preserves the claim. Do not paste the next block after a nonzero exit.

After the parent is resolved and sufficiently funded, create the five children in order. This block stops on the first nonzero exit; never put it in a retry loop:

```sh
(
  set -eu
  node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-core
  node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-owner
  node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-issuer
  node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-provider-a
  node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-provider-b
)
```

Every next child requires final successful creation evidence for the preceding children. A later command cannot move past an unresolved earlier transaction. A repeated completed command also refuses; continue manually at the next unclaimed step after inspecting the original evidence.

Proceed to [T18 owner, merchant and issuer setup](testnet-demo-runbook.md#owner-merchant-and-issuer-setup) with these existing accounts and generated public files. **Skip T18's manual template/directory creation and render blocks** because this bundle already contains those files. The T18 runner still expects the correct setup key loaded for each role. Keep owner/deploy/issuer/account keys out of worker/MCP/buyer environments; use only the worker record for the restricted worker and each invoice seed only for its own provider. This helper does not load those roles into later processes. Prepare the [separate buyer configuration](../examples/buyer-agent/README.md) with fresh buyer IDs, and perform the buyer run before T18 revokes B's credential or changes B's identity.

A second rehearsal needs a separately prepared and funded environment with fresh core/role accounts, IDs, journals, buyer configuration and capture paths. Do not reset or repurpose a completed or uncertain bundle to manufacture a clean run. A new environment has its own 9.5 NEAR allocation plus reserve and is not covered by the first parent's original grant.

## Uncertain results and observation

A durable claim is written and synced **before** the faucet POST or child broadcast. There is at most one POST per bundle and one send per child claim. A crash between claiming and dispatch intentionally remains unresolved; absence does not unlock another request. The SDK provider uses one total RPC attempt. Child creation avoids the convenience methods that can retry invalid nonces.

Use the exact saved bundle and corresponding observation step:

```sh
node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step observe-faucet
node dist/examples/testnet-demo/src/bootstrap.js --user-run --directory "$AGENTTRUST_DEMO_DIR" --step observe-create-core
```

These are alternative individual observations, not a sequence to run blindly. Every fixed step has an `observe-` form. Observation builds no signer, nonce or transaction and never sends. It reads the saved parent/account/key or exact saved transaction. A matching parent after an uncertain faucet request is labeled `observed`; that lookup does not prove helper completion or the original grant amount. A finalized child failure, missing transaction, mismatched action/key, transport error or malformed response remains unresolved and cannot be resent through this helper. Do not delete claims, copy a bundle to invent a new capture, change IDs or request a fresh parent to escape uncertainty. Keep the original records for manual investigation.

The result labels mean:

- `prepared`: local files only, no account creation or network contact.
- `created`: this explicit invocation received completion and verified its resulting account/key (plus the exact successful final transaction for a child).
- `observed`: later read-only confirmation against a saved claim; not a fresh creation.
- `uncertain`: evidence could not resolve the saved operation; no retry is allowed.

All records explicitly leave native runtime and model gates `not_evaluated`. RPC observations are trusted endpoint responses, not light-client proofs. The helper tests use local files, offline cryptography and RPC/faucet/signing doubles; live availability, actual faucet grant, account creation and costs remain user-run checks.

## Faucet provenance and limits

The fixed URL `https://helper.nearprotocol.com/account` and JSON fields `newAccountId`/`newAccountPublicKey` follow the official [near-cli-rs testnet configuration](https://github.com/near/near-cli-rs/blob/main/src/config/mod.rs) and [faucet creation implementation](https://github.com/near/near-cli-rs/blob/main/src/commands/account/create_account/sponsor_by_faucet_service/mod.rs), inspected November 12, 2026. The public [helper source](https://github.com/near/near-contract-helper/blob/master/app.js) applies an IP limiter of ten creations per twelve hours; that is published source behavior, not a verified promise about the current hosted deployment. Its grant is environment-configured: the [.env sample](https://github.com/near/near-contract-helper/blob/master/.env.sample) uses 10 NEAR. This helper therefore verifies actual final funding instead of assuming a quota or grant. It never bypasses the limiter or automatically invokes a second/top-up faucet.
