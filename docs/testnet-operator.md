# Operator route: one complete testnet rehearsal

Use this route on macOS/Linux from the accepted repository root. It joins the existing bootstrap, local stack, T18 cases and buyer commands; it does not automatically advance or retry. **The commands marked `--user-run` can create accounts, deploy/change contracts or spend testnet NEAR. The model buyer also consumes NEAR AI Cloud credits.** No browser is opened. Native/runtime acceptance, actual model execution and two completed rehearsals require their own captured results; a build or local listener is insufficient.

The operator loads the fixed step's key into its child only: core/owner/issuer/merchant for setup, restricted worker for purchases, and each provider's invoice seed for that provider. The web/docs receive no signing keys. Do not print secret files, export owner keys manually, put keys in commands or send them in chat. Enter the model API key locally with echo disabled or load the private local file as shown below.

## 1. Prepare a fresh bundle

Use one operator terminal for the setup, worker and buyer commands. These public variables and shortcuts remain in that shell. Every capture name below is exclusive; replace **every** `r1` in both terminal snippets with the same fresh run label when prior captures exist. Changing a capture prefix never makes a previously submitted operation safe to resend.

```sh
. scripts/env.sh
export AGENTTRUST_DEMO_DIR="$PWD/.agenttrust/testnet-demo-r1"
export AGENTTRUST_TLS_DIR="$PWD/.agenttrust/local-tls-r1"
export AGENTTRUST_CAPTURE_PREFIX="artifacts/local/testnet/r1"
at_setup() { pnpm demo:operator --user-run --directory "$AGENTTRUST_DEMO_DIR" --setup "$1" --output "$AGENTTRUST_CAPTURE_PREFIX-$2"; }
at_worker() { pnpm demo:operator --user-run --directory "$AGENTTRUST_DEMO_DIR" --worker "$1" --output "$AGENTTRUST_CAPTURE_PREFIX-$2"; }
at_check() { pnpm demo:evidence:check "$AGENTTRUST_CAPTURE_PREFIX-$1/manifest.json"; }
```

Build and prepare local files, with no network account operation:

```sh
(
  set -eu
  umask 077
  mkdir -p "$PWD/.agenttrust"
  pnpm build:contract
  pnpm build:services
  pnpm build:surfaces
  pnpm demo:bootstrap:testnet --prepare --directory "$AGENTTRUST_DEMO_DIR"
)
```

Preparation exclusively creates private keys, public demo/provider/MCP files and fresh IDs. It binds the actual inspected production WASM and generates **24-hour session/credential expiries**, so prepare when ready to rehearse. It refuses an existing directory. Do not run the manual template/render blocks in the [T18 runbook](testnet-demo-runbook.md); these files already exist.

Explicitly provision the fresh parent once:

```sh
pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step faucet
```

Inspect its evidence before continuing. The helper's actual grant/availability is not guaranteed. Before the first child, the helper requires at least 10 NEAR gross and checks storage/gas headroom; allocations total 9.5 NEAR. It checks the remaining budget on later steps. No top-up happens automatically. [Bootstrap details and source limits](testnet-bootstrap.md) explain the fixed accounts, private records and faucet behavior.

On a resolved successful parent, create the children in order:

```sh
(
  set -eu
  pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-core
  pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-owner
  pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-issuer
  pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-provider-a
  pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step create-provider-b
)
```

**Stop at any nonzero exit or unresolved result throughout this runbook.** A fail-fast block stops only that block; do not paste the next block until the issue is resolved. Never rerun a whole block after partial success. Use the saved operation's observation path, then continue at the next unclaimed step.

## 2. Configure TLS and start the local stack

Create one localhost certificate and update only the two provider TLS paths. This changes ordinary private files and no OS/browser trust store:

```sh
export NODE_EXTRA_CA_CERTS="$AGENTTRUST_TLS_DIR/localhost.crt"
(
  set -eu
  umask 077
  mkdir -m 700 "$AGENTTRUST_TLS_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 3 \
    -subj /CN=localhost \
    -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
    -keyout "$AGENTTRUST_TLS_DIR/localhost.key" \
    -out "$AGENTTRUST_TLS_DIR/localhost.crt"
  chmod 600 "$AGENTTRUST_TLS_DIR/localhost.key"
  node --input-type=module - "$AGENTTRUST_DEMO_DIR" "$AGENTTRUST_TLS_DIR" <<'NODE'
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
const [directory, tls] = process.argv.slice(2);
for (const name of ["provider-a.json", "provider-b.json"]) {
  const file = path.join(directory, name), config = JSON.parse(readFileSync(file, "utf8"));
  config.tls = {cert_file: path.join(tls, "localhost.crt"), key_file: path.join(tls, "localhost.key")};
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n", {mode: 0o600});
}
NODE
  pnpm demo:operator --directory "$AGENTTRUST_DEMO_DIR" --local check
)
```

`check` is offline: it checks public bindings, signer/TLS matches, builds and ports. It refuses Next-loadable `.env`, `.env.local`, `.env.production` and `.env.production.local` files in web/docs, because they bypass the isolated environment. If present, move them aside yourself as described in [local-demo.md](local-demo.md). Do not bypass the check or disable TLS verification.

After `check` passes, open a **second terminal**, change to this same repository root and start the stack there. For this first run:

```sh
(
  set -eu
  . scripts/env.sh
  export AGENTTRUST_DEMO_DIR="$PWD/.agenttrust/testnet-demo-r1"
  export NODE_EXTRA_CA_CERTS="$PWD/.agenttrust/local-tls-r1/localhost.crt"
  pnpm demo:operator --directory "$AGENTTRUST_DEMO_DIR" --local start
)
```

Leave it running while using the first terminal below. It owns localhost providers on 4041/4042 and the existing web/docs on 3000/3001, refuses occupied ports and reports `chain_verification: not_checked`. A ready listener proves no chain registration or payment. No provider seed needs copying into the shell.

## 3. Set up the native roles

Back in the first terminal, deploy to the empty core and configure the five roles. The launcher chooses each setup key internally; each invocation is a separate child process.

```sh
(
  set -eu
  at_setup deploy-core 01-deploy
  at_setup owner-deposit 02-owner-deposit
  at_setup issuer-deposit 03-issuer-deposit
  at_setup provider-a-deposit 04-a-deposit
  at_setup provider-a-register 05-a-register
  at_setup provider-b-deposit 06-b-deposit
  at_setup provider-b-register 07-b-register
  at_setup owner-profile 08-profile
  at_setup owner-trust-a 09-trust-a
  at_setup owner-trust-b 10-trust-b
  at_setup owner-session 11-session
  at_setup owner-worker-key 12-worker-key
  at_setup owner-policy 13-policy
)
```

Validate B's identity and bounded conformance suite before credential issuance:

```sh
at_setup validate-b 14-validation
```

Inspect the validation capture's signed identity and per-fixture checks. This `prepared` result has not issued a credential. The separate issuer step revalidates immediately before signing; provider A intentionally receives no credential:

```sh
at_setup issuer-issue-b 15-credential
```

## 4. Prove the paid task, then run the model buyer

Run the direct missing-evidence refusal, B's paid report, and exact retry:

```sh
(
  set -eu
  at_worker missing-credential 16-missing
  at_worker purchase 17-purchase
  at_worker retry 18-retry
  at_check 16-missing
  at_check 17-purchase
  at_check 18-retry
)
```

Inspect the actual FINAL `MISSING` rejection with zero payout, settled `0.002 NEAR` purchase and checked report, then `duplicate:true` retry with no second payout. The direct retry consumes gas. Do not treat a preview, HTTP response or transaction hash as completed evidence.

**Run buyers before revoking B's credential or changing its identity.** Each mode needs its own exclusively prepared job and two payment IDs; neither may reuse T18's paid ID. The scripted buyer is an optional engineering check. To include it, prepare its job offline, then execute it explicitly:

```sh
(
  set -eu
  pnpm demo:prepare:buyer --directory "$AGENTTRUST_DEMO_DIR" --mode scripted
  pnpm demo:operator --user-run --directory "$AGENTTRUST_DEMO_DIR" --buyer scripted
)
```

Inspect its checked paid output and private trace. `scripted_harness_not_autonomous` is useful execution evidence, not an actual model run. Keep this job intact if it stops; do not reprepare it.

Choose an exact ready, tool-capable model ID from the [current public NEAR AI catalog](https://cloud-api.near.ai/v1/model/list). In zsh, enter that public ID and prepare a separate model job:

```sh
(
  set -eu
  read -r 'AGENTTRUST_BUYER_MODEL?Exact ready tool-capable model ID: '
  pnpm demo:prepare:buyer --directory "$AGENTTRUST_DEMO_DIR" --mode near-ai --model "$AGENTTRUST_BUYER_MODEL"
)
```

The [hackathon instructions, Q-000](https://nearhackathon.com/HACKATHON.md), offer a separate $10 NEAR AI API key through an eligible NEAR Builders profile during the claim window. That balance does not appear in the Cloud dashboard. The [Builders key implementation](https://github.com/nearbuilders/nearbuilders.org/blob/3e1d09df362cd0136e1b02275a1c80e0177283f8/plugins/credits/src/services/nearai-keys.ts#L193-L210) creates the key through the Cloud API, but this project has not yet made an authenticated model call with a Builders key. Save the one-time revealed key privately if using that route. A key made in the Cloud dashboard instead needs credits in that workspace.

Enter the chosen NEAR AI API key **only in this local terminal**, never in chat or the configuration. The subshell keeps it out of the parent shell afterward; the MCP child receives only the restricted worker key and explicit CA, not this API key:

```sh
(
  set -eu
  read -rs 'NEAR_AI_API_KEY?NEAR AI Cloud API key (hidden): '
  export NEAR_AI_API_KEY
  pnpm demo:operator --user-run --directory "$AGENTTRUST_DEMO_DIR" --buyer near-ai
)
```

If the key was already saved at `.agenttrust/near-ai-api-key`, use this alternative instead. It requires a nonempty regular file owned by the current user with mode `0600`; the key is never printed or placed in command arguments:

```sh
(
  set -eu
  key_file="$PWD/.agenttrust/near-ai-api-key"
  test -f "$key_file" && test -s "$key_file"
  case "$(uname -s)" in
    Darwin) key_uid="$(stat -f %u "$key_file")"; key_mode="$(stat -f %Lp "$key_file")" ;;
    Linux) key_uid="$(stat -c %u "$key_file")"; key_mode="$(stat -c %a "$key_file")" ;;
    *) exit 1 ;;
  esac
  test "$key_uid" = "$(id -u)" && test "$key_mode" = 600
  NEAR_AI_API_KEY="$(cat "$key_file")"
  test -n "$NEAR_AI_API_KEY"
  export NEAR_AI_API_KEY
  pnpm demo:operator --user-run --directory "$AGENTTRUST_DEMO_DIR" --buyer near-ai
)
```

This can incur model charges. The prepared job allows eight model/tool steps and 1,024 output tokens per request; these limits are not a dollar cap. Inspect `kind: paid`, the checked output and actual model/tool trace with received model responses. `recorded_replay` or zero model responses does not prove a fresh model-driven run. The jobs and redacted trace files remain under the private demo directory; [buyer documentation](../examples/buyer-agent/README.md) explains their bindings and limits. Never run either buyer concurrently with T18, the other buyer or another worker. Stop here if the model job or any attempted scripted job is pending, uncertain or otherwise unresolved.

## 5. Run the state-changing negative cases last

Only after reviewing successful T18 purchase/retry, the actual-model buyer and any attempted scripted job, revoke B's credential and prove the direct refusal:

```sh
(
  set -eu
  at_setup issuer-revoke-b 19-revoke
  at_worker revoked-credential 20-revoked
  at_check 20-revoked
)
```

For identity mutation, the old quote lasts about 120 seconds. Run these separate role-isolated invocations immediately in order:

```sh
(
  set -eu
  at_worker identity-quote 21-identity-quote
  at_setup provider-b-rotate 22-rotate
  at_worker changed-identity 23-identity-refusal
  at_check 23-identity-refusal
)
```

Require actual FINAL `REVOKED` and `IDENTITY_CHANGED` rejections with no payment/payout. An expired quote is a failed identity test, not a substitute result. Do not restore state, replace the original quote or change IDs to hide a failure. B's old offer may remain running for these checks and for retrieval of the original settled report. New B purchases are intentionally blocked now.

Check every retained T18 capture, including preparation, failure and observation records:

```sh
(
  set -eu
  for manifest in "$AGENTTRUST_CAPTURE_PREFIX"-*/manifest.json; do
    pnpm demo:evidence:check "$manifest"
  done
)
```

The checker establishes file/hash/shape integrity and required evidence, not independent RPC truth or full hackathon readiness. Inspect the original raw outcomes and payout intervals too. To display actual refusal rows, use the [local feed instructions](local-demo.md#one-terminal-for-the-local-stack) with this run's `16-missing`, `20-revoked` and `23-identity-refusal` transaction locator paths under the chosen capture prefix; restart the stack after setting the public references. This route performs no visual/browser check.

## Recovery and stopping

Ctrl-C stops the operator's POSIX child process group, including its local listeners or the buyer's MCP child. **Stopping a process cannot undo an already broadcast payment.** Inspect the original immutable attempt/job/operation journals before doing anything else. An unknown, missing, pending or timed-out result never means unpaid. Do not delete records, change IDs, copy a bundle or switch suppliers to force another payment.

Use only the observation matching the interrupted operation. These examples are alternatives, not a block to execute together; each new observation needs an unused capture suffix:

```sh
pnpm demo:bootstrap:testnet --user-run --directory "$AGENTTRUST_DEMO_DIR" --step observe-faucet
```

```sh
at_setup observe-owner-deposit 24-observe-owner-deposit
```

```sh
at_worker resume 25-resume-purchase
```

```sh
at_worker observe-retry 26-observe-retry
```

Every bootstrap step has `observe-<original-step>`. Setup has that form except `validate-b`. Direct worker refusals have `observe-missing-credential`, `observe-revoked-credential` and `observe-changed-identity`. Operator setup observations, worker observations and T18 `resume` need only the original public configuration and journals; no private bundle or signer is loaded. Bootstrap observations validate their original private bundle but construct no signer. T18 `resume` applies only to T18's exact fixture and saved paid ID, not a separate buyer job. Compare it with the original purchase's `payout-before.json` because a later observation cannot recreate the original balance interval.

For a buyer whose definitive checked paid result is already saved, replay without keys or any network/MCP startup:

```sh
pnpm demo:operator --directory "$AGENTTRUST_DEMO_DIR" --replay-buyer scripted
```

```sh
pnpm demo:operator --directory "$AGENTTRUST_DEMO_DIR" --replay-buyer near-ai
```

These return the original checked report as `recorded_replay`; they are not new chain observations or model sessions. If the job is unfinished or its records conflict, replay stops without adding credentials or sending. Preserve that job's exact selected payment ID and use the keyless MCP `get_payment` read described in the [buyer recovery guidance](../examples/buyer-agent/README.md#durable-selection-and-stopping-rules). Read results do not authorize a replacement job or payment. Re-entering the executable buyer mode is a separate explicit action and may incur further model charges; never change its saved configuration/IDs to escape uncertainty.

## Second fresh rehearsal

First resolve every first-run operation and retain all its files. Stop the first local stack in its terminal. In the operator terminal choose new directories and capture names:

```sh
export AGENTTRUST_DEMO_DIR="$PWD/.agenttrust/testnet-demo-r2"
export AGENTTRUST_TLS_DIR="$PWD/.agenttrust/local-tls-r2"
export AGENTTRUST_CAPTURE_PREFIX="artifacts/local/testnet/r2"
```

Keep the shell shortcuts; they read these updated variables. Repeat the build/offline preparation block onward, including explicit faucet/children, TLS paths, setup, fresh buyer configurations, paid/retry/model runs and finally revocation/rotation. Use `r2` paths in the second terminal before starting its stack. This creates fresh role accounts, worker/invoice keys, core state, session/credential/payment/job IDs and capture files; it is a separately funded environment, not a reset of rehearsal one.

Two fresh reviewed runs are still distinct from the broader native runtime/cap/pending/failure matrix and unperformed visual checks. Record actual results and remaining gaps; this operator route alone does not mark those gates passed.
