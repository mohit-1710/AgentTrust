# T18: explicit native testnet paid-task run

**Prepared, not executed by the agent.** These commands can deploy, fund contract balances, install a restricted key, change policy/credentials and spend testnet NEAR. They are for the operator to run explicitly. No native testnet payment, T13 runtime gate, two-rehearsal gate or hackathon readiness is established by compiling this runner. Every operational invocation requires `--user-run`; there is no default network seed, account creation, faucet, mainnet mode or automatic retry.

This is a scripted two-provider run using the real SDK, signed invoices, project-operated issuer, provider and committed synthetic `mixed-validity` CSV. Provider A is trusted by identity but has **missing capability evidence**. Provider B passes the bounded conformance suite and receives a credential. This does not establish real-world invoice correctness, independent issuer reputation or an autonomous model run. The T20 buyer is a separate surface.

## Prerequisites and boundaries

- Run from the accepted repository root/commit, with the pinned installed Node/pnpm/Rust tools. Do not run from an unreviewed dirty tree for acceptance evidence. Source revision and dirty status are captured; the actual WASM hash is authoritative for deployed bytes.
- Supply existing, separately controlled testnet core, owner, issuer and two merchant/service accounts. Supply existing payout accounts and a different existing payout for the identity mutation. Service accounts may receive their own payouts. A payout cannot be the owner paying transaction gas or the core vault. Keep payout accounts idle during a case; another transfer makes its exact balance-delta assertion fail.
- Fund those accounts yourself before setup. This runner does not create accounts or call a faucet. Core deployment needs storage for the actual WASM, gas and the configured `0.05 NEAR` operating reserve; `6 testnet NEAR` is an illustrative provisioning budget for a roughly 381 KiB artifact, not a measured deployment cost. Check the actual binary/account balance. Owner setup deposits `1 NEAR` (`0.25` storage credit, `0.75` available). Each issuer/merchant deposits `0.1 NEAR`, all storage credit. Each signing account also needs transaction gas beyond its deposit. The default paid task transfers `0.002 NEAR`; configured purchase/day limits are `0.01/0.05 NEAR`, rate limit five dispatches per fixed minute. Worker allowance is a finite `0.05 NEAR` gas allowance on the owner account, not extra transferred funds.
- Supply a dedicated existing Ed25519 worker key pair and two dedicated invoice-signing seeds. This preparation generates only public random operation IDs, never private keys. The worker public key is an `ed25519:...` NEAR key. Each invoice key is the **raw 32-byte Ed25519 public key in canonical base64**, matching its provider's seed. Do not put a private key/seed in JSON, shell history, repository files, captures, screenshots or browser bundles.
- Setup uses one role key at a time in `AGENTTRUST_SETUP_PRIVATE_KEY`; the fixed step chooses its account. The worker uses only `AGENTTRUST_WORKER_PRIVATE_KEY`. The launcher forwards only the appropriate role variable, PATH/temporary-system paths and explicit `NODE_EXTRA_CA_CERTS`; it drops owner/issuer/deploy keys, invoice seeds, HOME wallet discovery, arbitrary NODE_OPTIONS and TLS-disable variables from worker processes.
- Configure the two actual HTTPS origins before validation/payment. [T26 local setup](local-demo.md) prepares `.agenttrust/local-tls/localhost.crt` and `localhost.key` for `https://localhost:4041` and `https://localhost:4042`. Use absolute `tls.cert_file`/`tls.key_file` paths in provider JSON and explicit `NODE_EXTRA_CA_CERTS` in Node clients. No OS trust-store or browser changes are needed. An HTTP-only loopback listener does not satisfy the HTTPS identity commitment. Do not disable certificate verification. An existing operator HTTPS reverse proxy is also possible if its canonical origin is registered exactly.
- Do not run concurrent worker/MCP/buyer purchases during this capture. Keep the original public config, IDs, immutable attempts and operation files. Journals are ordinary private JSON files, not a database. Their parent directory must exist; journal directory mode is `0700`, files `0600`.

The only deployment helper targets an **existing core account with no code**. It checks actual `status.chain_id === testnet`, full-access authority and the reviewed production WASM SHA-256, rejects the runtime-fault marker, then submits one deploy-and-`new` transaction. It never upgrades existing code. If a reviewed core is already deployed/initialized, skip `deploy-core`; subsequent steps verify its actual final code hash, network and core-account binding. All other state must be fresh for these fixed setup steps; they refuse repeated deposits/registrations rather than silently modifying an existing demo.

## Public configuration and local build

These local commands prepare files/builds only. Set `AGENTTRUST_DEMO_DIR` to a fresh ignored directory; use a new file instead of overwriting an earlier run.

```sh
. scripts/env.sh
pnpm build:contract
pnpm build:services
shasum -a 256 target/wasm32-unknown-unknown/release/agenttrust_core.wasm
export AGENTTRUST_DEMO_DIR="$PWD/.agenttrust/testnet-demo-1"
(
  set -eu
  set -C
  umask 077
  mkdir -p "$PWD/.agenttrust"
  mkdir -m 700 "$AGENTTRUST_DEMO_DIR"
  pnpm --silent demo:prepare:testnet -- --template > "$AGENTTRUST_DEMO_DIR/demo.json"
)
```

The subshell stops on failure and refuses to overwrite files; pasting the block again leaves the original configuration/IDs intact. The directory export stays in the parent shell for later commands. Edit `demo.json`: replace every `REPLACE` value with real public account/key metadata and the reviewed binary hash; set `attempts_directory` to `$AGENTTRUST_DEMO_DIR/attempts` as its expanded absolute path. The template's session/credential expiries are 24 hours from generation. Review expiry and prices before any setup. Do not regenerate payment/session/credential IDs midway. No addresses are supplied as supposedly deployed defaults. The strict parser rejects extra fields, noncanonical HTTPS origins, mixed domains and duplicate role/operation IDs.

Render the two provider and MCP public configurations after filling the template:

```sh
(
  set -eu
  set -C
  umask 077
  pnpm --silent demo:prepare:testnet -- --render-config "$AGENTTRUST_DEMO_DIR/demo.json" > "$AGENTTRUST_DEMO_DIR/public-configs.json"
  node --input-type=module -e 'import {readFileSync,writeFileSync} from "node:fs"; const d=process.argv[1]; const c=JSON.parse(readFileSync(d+"/public-configs.json","utf8")); for (const [file,key] of [["provider-a.json","provider_a"],["provider-b.json","provider_b"],["mcp.json","mcp"]]) writeFileSync(d+"/"+file,JSON.stringify(c[key],null,2)+"\n",{flag:"wx",mode:0o600});' "$AGENTTRUST_DEMO_DIR"
)
```

Set the two provider files' absolute TLS certificate/key paths using [local-demo.md](local-demo.md). Those paths are intentionally incomplete placeholders. Do not change the committed origin/service/version while retaining an old quote. The MCP config contains public metadata only; it is for the T19 local server, not an issuer/setup process.

## Owner, merchant and issuer setup

Inspect each step's result before proceeding. The multi-command blocks below use fail-fast subshells: a nonzero exit stops that block. It is not permission to paste the next block. Stop at any nonzero exit or uncertain result and use the recovery instructions below. Never put the sequence in an automatic retry loop. Every `--output` must name a **new** directory under ignored `artifacts/local/testnet/`; captures are not overwritten. Choose another descriptive name for a second observation, not a new payment ID.

Load a role key interactively in the operator's shell (zsh example); use this same pattern when changing roles. Replace neither the prompt nor the environment name with a literal secret command argument:

```sh
unset AGENTTRUST_WORKER_PRIVATE_KEY AGENTTRUST_SETUP_PRIVATE_KEY AGENTTRUST_INVOICE_SEED_BASE64
read -rs 'AGENTTRUST_SETUP_PRIVATE_KEY?Paste the current role key locally: '
export AGENTTRUST_SETUP_PRIVATE_KEY
```

With the **core account** full-access key, only if the account has no deployed code:

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/01-deploy --step deploy-core
```

Switch to the **owner** full-access key:

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/02-owner-deposit --step owner-deposit
```

Switch to the **issuer** key:

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/03-issuer-deposit --step issuer-deposit
```

Switch to **provider A's merchant account** key:

```sh
(
  set -eu
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/04-a-deposit --step provider-a-deposit
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/05-a-register --step provider-a-register
)
```

Switch to **provider B's merchant account** key:

```sh
(
  set -eu
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/06-b-deposit --step provider-b-deposit
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/07-b-register --step provider-b-register
)
```

Switch back to the **owner** key. These actions create the pinned `invoice.audit.v1` profile, trust both exact service identities, bind the worker session, install the finite-allowance function-call key and finally unpause the owner policy. The worker key is restricted to `execute_payment` on this exact core account; it cannot attach a deposit or perform setup.

```sh
(
  set -eu
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/08-profile --step owner-profile
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/09-trust-a --step owner-trust-a
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/10-trust-b --step owner-trust-b
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/11-session --step owner-session
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/12-worker-key --step owner-worker-key
  pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/13-policy --step owner-policy
)
```

After inspecting the owner setup result, remove its key from the parent shell before changing roles:

```sh
unset AGENTTRUST_SETUP_PRIVATE_KEY
```

Start the two providers in separate terminals using their public JSON and their **invoice seed only**, following [T26](local-demo.md). Do not leave owner/setup/worker keys in a provider shell. Both listeners must present the configured HTTPS identity; a successful health response alone proves no payment or capability claim. Set process trust in the operator/client shell:

```sh
export NODE_EXTRA_CA_CERTS="$PWD/.agenttrust/local-tls/localhost.crt"
```

Prepare B's credential assertion **without any issuer key or transaction**:

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/14-validation --step validate-b
```

Inspect `validation.json`: signed identity challenge, exact registry binding, pinned suite, per-fixture input/golden/response hashes and output checks. `prepared` is not an on-chain credential. Load the **issuer** role key explicitly, then issue B's credential. This separate issuer command re-runs validation immediately before issuing; any failing fixture or identity mismatch stops before signing. It does not blindly trust a previously edited draft. No credential is issued for A.

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/15-credential --step issuer-issue-b
unset AGENTTRUST_SETUP_PRIVATE_KEY
```

## Worker paid-task and refusal cases

Load only the dedicated worker key in this shell; the launcher additionally isolates the child environment. Keep the issuer/merchant keys in separate operator invocations when required below.

```sh
unset AGENTTRUST_SETUP_PRIVATE_KEY AGENTTRUST_INVOICE_SEED_BASE64
read -rs 'AGENTTRUST_WORKER_PRIVATE_KEY?Paste the restricted worker key locally: '
export AGENTTRUST_WORKER_PRIVATE_KEY
```

Run the actual missing-evidence refusal, then B's paid report, then an exact retry:

```sh
(
  set -eu
  pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/16-missing --step missing-credential
  pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/17-purchase --step purchase
  pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/18-retry --step retry
)
```

- `missing-credential` checks the pinned capability profile, uses provider A with no credential, records the preview denial and **also executes the exact signed invoice directly** with the restricted key. It requires an actual FINAL `MISSING` rejection, no payment record and zero payout delta. A preview alone cannot pass this case.
- `purchase` uses provider B, exact fixed input/payment ID and credential revision. The real SDK persists the quote before broadcasting, waits for final admission and a settled payment, calls the paid provider and checks the actual report against input and the committed golden result. HTTP 200 or a transaction hash alone cannot pass. The capture requires the configured payout delta and settled final contract state.
- `retry` retrieves the same report through the saved attempt, then submits the exact original invoice once to demonstrate contract idempotency. It requires `duplicate:true`, the unchanged invoice/payment and no second payout. It consumes transaction gas. The direct retry itself has an immutable one-send operation record; another invocation must use `observe-retry`.

**Stop here before the negative state changes.** Inspect successful T18 purchase/retry captures, then run the fresh [T20 buyer job](../examples/buyer-agent/README.md) while B's credential and identity are still active. Its job and two payment IDs must differ from this runbook's four IDs; otherwise a saved report could be mistaken for a new model-driven purchase. Run the actual model mode separately from any scripted job. Keep the same files/IDs when recovering either job. A successful saved replay with zero model responses is not a new actual-agent run. Export `NODE_EXTRA_CA_CERTS` in the buyer's shell as well.

Prepare that fresh job offline with the implemented helper. Choose the public `AGENTTRUST_BUYER_MODEL` value from the current [model catalog](https://cloud-api.near.ai/v1/model/list), then run:

```sh
pnpm demo:prepare:buyer --directory "$AGENTTRUST_DEMO_DIR" --mode near-ai --model "$AGENTTRUST_BUYER_MODEL"
```

This exclusively creates `buyer-near-ai.json` with fresh IDs, actual configured A/B service IDs, the existing MCP path and the committed synthetic CSV. It performs no network/key/model/payment operation. A separate `--mode scripted` command creates `buyer-scripted.json`; it cannot be converted into model evidence by editing its mode. The [buyer runbook](../examples/buyer-agent/README.md) gives the separate explicit execution command and key/CA setup. Preparation alone does not clear the next gate.

Proceed only after reviewing successful purchase, exact retry and actual buyer output/trace. A stopped, pending or uncertain buyer must be investigated using its original files; do not revoke/rotate as a way to resolve it. These state-changing negative checks make new B purchases impossible in this prepared environment. They belong after the useful task in each rehearsal.

In a separate setup invocation, load the **issuer** key and revoke B's credential:

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/19-revoke --step issuer-revoke-b
```

From the **worker-only** shell, prove a fresh revoked-credential attempt cannot pay. The runner requires the actual credential already be revoked before calling the paid API, and requires a direct FINAL `REVOKED` rejection and zero payout:

```sh
pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/20-revoked --step revoked-credential
```

Prepare the identity-mutation case with a fresh original B quote and deliberately omitted evidence. This saves a quote and returns `prepared`; it sends no payment. Then immediately switch the merchant's payout using the **provider B merchant** key and run `changed-identity` with the **worker** key. These are separate processes/role shells. The default quote lasts 120 seconds; inspect the captured expiry. Do not bundle the role keys into the worker environment to save time.

```sh
pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/21-identity-quote --step identity-quote
```

```sh
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/22-rotate --step provider-b-rotate
```

```sh
pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/23-identity-refusal --step changed-identity
```

The old quote must receive a direct FINAL `IDENTITY_CHANGED` rejection with no payment/payout. If the quote expired first, the runner stops rather than relabeling an expiry as identity evidence. Do not restore registry state or replace the original quote to hide a failed case. The provider can remain on its original offer for this negative case; no new quote is requested after rotation. Old settled B purchase retrieval remains bound to the immutable original catalog/offer, so the `resume` observation can still retrieve it even after credential revocation, quote expiry or registry rotation. This is not permission for a new purchase.

## Second rehearsal

Keep the first run's configuration, journals and captures intact. New output folders alone do not reset an initialized core. For a second clean rehearsal, provision another empty testnet core account, a new private demo/attempt directory and fresh public session/credential/operation IDs. If reusing the same owner, use a different worker key pair: the first installed function-call key remains restricted to the first core. The registry/account records live inside each core, so existing separately controlled owner/issuer/merchant/payout accounts can be reused after every first-run operation is resolved and their balances/gas are checked.

Use distinct flat capture names such as `artifacts/local/testnet/r2-01-deploy` for every second-run step. Render the new provider/MCP and separate buyer files from that second configuration, stop the first local stack and restart with the second directory. Run setup, T18 paid/retry, fresh actual buyer, then revoke/rotate checks in that order. Do not reuse the first credential refs, installed worker key, buyer job or attempt IDs. Do not start another environment to work around any unresolved first-run payment. This is explicit fresh provisioning, not a reset or automatic reseed command.

## Recovery, captured evidence and acceptance

A timeout, unknown transaction, RPC error, pending payment or missing local journal is **never evidence of nonpayment**. Keep every operation ID and file. The SDK journal claims at most one submission; the direct setup/refusal/retry journal also refuses a second send across output directories and concurrent processes. A crash after a durable checkpoint but before broadcast can leave a locator that never appears on chain: this deliberately stops for inspection. These tools do not automatically unlock it or produce a new nonce. Do not delete journals or rename the operation to force another transfer.

For an interrupted **setup** step, unset the setup key and prefix its name with `observe-`. This is signer-free and reads the saved FINAL transaction plus final contract/access-key state. It never resubmits. For example:

```sh
unset AGENTTRUST_SETUP_PRIVATE_KEY
pnpm demo:prepare:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/24-observe-owner-deposit --step observe-owner-deposit
```

For an interrupted **paid purchase**, `resume` requires the existing signed attempt **and submission checkpoint** and calls the SDK observation/retrieval path. It requires no worker key, constructs no signer and cannot create a new quote or send. Compare its receipt and final state with the original purchase's `payout-before.json`; the resumed capture alone does not establish the original before/after balance interval.

```sh
unset AGENTTRUST_WORKER_PRIVATE_KEY AGENTTRUST_SETUP_PRIVATE_KEY AGENTTRUST_INVOICE_SEED_BASE64
pnpm demo:run:testnet -- --user-run --config "$AGENTTRUST_DEMO_DIR/demo.json" --output artifacts/local/testnet/25-resume-purchase --step resume
```

For a direct missing/revoked/identity refusal or duplicate retry, use respectively `observe-missing-credential`, `observe-revoked-credential`, `observe-changed-identity` or `observe-retry` with a new output directory. These keyless commands resolve the saved direct transaction; they never construct a signer or resend, even after invoice expiry. If an attempt was saved but has no submission checkpoint, stop for inspection instead of deleting it. A terminal failed transaction also requires review before any new operation; these CLIs intentionally provide no reset or forced retry.

Each command captures public config and domain, source commit/dirty status, actual Node/near-api-js version, configured tool pins/lock hash, expected/observed core code hash, role accounts, original command, status/exit code, exact signed attempt, request/output commitments, typed result, actual FINAL transaction/receipt responses and relevant final account/payment state. A signing-public-key fingerprint is included only when that invocation constructs a signer; keyless observations retain the original transaction context without implying a new signature. No private key, seed, environment dump or raw CSV is stored. Copying a capture creates a replay, not a fresh execution.

```sh
pnpm demo:evidence:check artifacts/local/testnet/17-purchase/manifest.json
pnpm demo:evidence:check artifacts/local/testnet/16-missing/manifest.json
```

Run the read-only checker on **every** retained step, including failures and observations. It checks schema/domain, contained regular files, hashes, FINAL transaction identity/receipt shape, final query metadata and required evidence for reported passes. It labels the original capture time and keeps `native_runtime_gate: user_run_required`. Hash integrity does not independently prove RPC honesty, authorship or every assertion. Inspect actual raw transaction outcomes, transferred amount/asset, input/output hash, final payment state and the no-payout evidence before accepting T18.

Validation, identity-quote preparation and keyless **setup** observations report `prepared`. Successful worker `resume`/`observe-*` commands report `passed` with `observation_only: true`: their checks concern the saved transaction, not a new execution. Other successful operational steps report `passed` for that named step only; failures report `failed`; unresolved submissions report `uncertain`. Nonzero results stop the sequence. No single manifest or green test suite completes T13/T18/T27. Two complete clean rehearsals still require fresh explicitly provisioned demo state and separate reviewed captures; this runner supplies no destructive reset, hidden reseed or fabricated second run. Visual/browser checks and the broader cap/pending/failure matrix remain separate gates.

The deployment/setup code uses the installed pinned `near-api-js@7.4.0` APIs reviewed in source: `KeyPairSigner.fromSecretKey`, `Account.createTransaction`, `signTransaction`, `actions.deployContract`, `actions.functionCall` and `provider.sendTransactionUntil(..., "FINAL")`. Imports and `--help` do not execute those operations.
