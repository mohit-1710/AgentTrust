# Local demo environment

The event permits a local paid demo with a public repository, reproducible instructions and a video. The read-only website and docs are [already public](hosting-evidence.md); this runbook prepares local providers and surfaces without hosting a signer or paid service. These startup commands alone do not establish a native payment; the separate [r3](testnet-r3-evidence.md) and [r4](testnet-r4-evidence.md) captures do. Keep the repository private until the separately authorized release; the final video must show actual captured results.

All listeners below bind to `127.0.0.1`. No command opens a browser, installs a certificate in the OS, creates a NEAR account, deploys a contract or starts Sandbox. Provider startup itself does not send transactions. The separate T18 setup and purchase commands are explicitly user-run and must pass their evidence gates before claiming a paid task.

## Build and public surfaces

From the repository root, use the pinned tools:

```sh
. scripts/env.sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:services
pnpm build:surfaces
```

Start the two surfaces in separate terminals when needed:

```sh
pnpm --filter web exec next start --hostname 127.0.0.1 --port 3000
pnpm --filter docs-site exec next start --hostname 127.0.0.1 --port 3001
```

Local URLs are `http://localhost:3000` and `http://localhost:3001`. The website's public origin configuration defaults to those values. For hosting, set the actual `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_DOCS_URL` before building. There is no public hosting claim from these defaults. Vercel telemetry components render only when `VERCEL=1`, avoiding nonexistent local telemetry endpoints.

The decisions feed is disconnected until its three server-only network/core/owner variables are set, as documented in `web/.env.example`. Those are public identifiers, not signing keys. Never give the website an owner, issuer, merchant or worker private key. Rebuild/restart after configuration changes. The separate [public read-only deployment](hosting-evidence.md) does not supply a paid-provider origin for this local launcher.

## One terminal for the local stack

After the [testnet runbook](testnet-demo-runbook.md) has produced your public `demo.json`, `provider-a.json`, `provider-b.json` and `mcp.json`, fill in each provider's TLS file paths as described below. Supply the two local invoice seeds through `AGENTTRUST_PROVIDER_A_INVOICE_SEED_BASE64` and `AGENTTRUST_PROVIDER_B_INVOICE_SEED_BASE64`. These are provider invoice keys, not account or worker keys. Do not paste keys into JSON, commands saved in shell history, recordings or Git.

```sh
pnpm demo:local --check --directory "$AGENTTRUST_DEMO_DIR"
pnpm demo:local --start --directory "$AGENTTRUST_DEMO_DIR"
```

`--check` verifies the exact shared public configuration, each invoice signer, localhost TLS identity/key pair, build artifacts and free ports. It performs no RPC or model call. `--start` runs both providers plus the existing web/docs surfaces, waits for HTTP health, and stops its children on Ctrl-C or a child failure. It refuses occupied ports instead of stopping another process. Provider configuration is snapshotted for the lifetime of the stack.

Each provider receives only its own invoice seed. The surfaces receive no signing or model credentials; the web receives the demo's three public NEAR identifiers and the docs assistant stays disabled. The command refuses `.env`, `.env.local`, `.env.production` or `.env.production.local` in either surface directory, because Next would load those files outside the launcher environment. Move any such local files aside yourself before using this isolated path; `.env.example` is fine. The MCP/buyer remains a separate explicitly invoked process under the buyer runbook.

After the direct refusal captures have passed inspection, supply their actual public transaction locators to the existing website feed. Stop this stack, run the following in its operator shell using the capture paths from the same core/owner, then restart it. This only reads files and sets a public variable:

```sh
unset AGENTTRUST_NEAR_DECISION_REFS
AGENTTRUST_NEAR_DECISION_REFS="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; console.log(JSON.stringify(process.argv.slice(1).map(p=>JSON.parse(readFileSync(p,"utf8")))));' artifacts/local/testnet/16-missing/transaction-before-send.json artifacts/local/testnet/20-revoked/transaction-before-send.json artifacts/local/testnet/23-identity-refusal/transaction-before-send.json)" &&
export AGENTTRUST_NEAR_DECISION_REFS
```

The launcher validates at most eight distinct, exact owner/hash references and forwards them only to web. The website independently verifies the corresponding FINAL calls; a supplied hash alone does not create a verified rejection row. Do not mix references from different cores or describe a preview as an executed refusal. Restarting the local stack does not rerun a purchase or reset any journal.

Successful startup prints `local_listeners_ready` and `chain_verification: not_checked`. It does not establish contract deployment, provider registration, native payment, model execution or recording readiness. There is no browser launch. For the repeatable offline listener check, after building both surfaces run `pnpm test:local:stack`; this uses temporary synthetic configuration, ephemeral invoice keys and a localhost certificate, checks signed quotes and web/docs HTTP, then stops every child. It never pays or starts Sandbox.

## HTTPS for the two local providers

The SDK requires canonical HTTPS service origins. For a reproducible local demo use `https://localhost:4041` and `https://localhost:4042`, with different registered service accounts. The service/version catalog, registered endpoint hashes and provider configurations must all commit to these exact origins, including the ports.

Create a short-lived localhost certificate in an ignored private directory. These commands create only ordinary certificate files; they do not modify any trust store. Use a new empty directory so no certificate or key is overwritten:

```sh
(
set -e
umask 077
mkdir -p .agenttrust
mkdir .agenttrust/local-tls
openssl req -x509 -newkey rsa:2048 -nodes -days 3 \
  -subj /CN=localhost \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
  -keyout .agenttrust/local-tls/localhost.key \
  -out .agenttrust/local-tls/localhost.crt
chmod 600 .agenttrust/local-tls/localhost.key
)
```

Each public provider configuration can include:

```json
{
  "port": 4041,
  "tls": {
    "cert_file": "/absolute/checkout/.agenttrust/local-tls/localhost.crt",
    "key_file": "/absolute/checkout/.agenttrust/local-tls/localhost.key"
  }
}
```

This is a fragment of the full configuration described in `examples/invoice-audit/README.md`. The configured offer origin must match the local TLS port; use `4042` for the second provider. The TLS private key must be an owner-readable file without group/other permissions. It is distinct from both the HTTP invoice signing seed and NEAR account keys. No private key or invoice seed belongs in the public JSON.

Run each provider in a separate process with its own `AGENTTRUST_INVOICE_SEED_BASE64` supplied locally, using its complete config:

```sh
pnpm start:invoice-audit --config /absolute/provider-a.json
pnpm start:invoice-audit --config /absolute/provider-b.json
```

Supply the certificate only to the Node process that needs it. This concrete read-only check uses the same process-scoped setting required by the validator, buyer and MCP:

```sh
NODE_EXTRA_CA_CERTS="$PWD/.agenttrust/local-tls/localhost.crt" node --input-type=module -e 'const r = await fetch("https://localhost:4041/health"); console.log(await r.json());'
```

Node reads this variable at process startup. Do not turn off TLS verification, modify browser security settings, or install this certificate system-wide. The process trusts the explicit localhost certificate in addition to normal roots. The TLS certificate is public; its private key remains local.

For a real public HTTPS origin, keep the existing HTTP listener behind your own HTTPS reverse proxy instead of using this local TLS option. Public hosting, DNS and reverse-proxy changes require their own authorized execution; none are performed by this runbook.

## Read-only checks and limits

These terminal requests verify only that the configured listener answers over trusted TLS:

```sh
curl --fail --cacert .agenttrust/local-tls/localhost.crt https://localhost:4041/health
curl --fail --cacert .agenttrust/local-tls/localhost.crt https://localhost:4042/health
curl --fail http://127.0.0.1:3000/api/decisions
curl --fail http://127.0.0.1:3001/api/ask
```

Provider health deliberately returns `status: configured` and `chain_verification: not_checked`. It exposes the configured network/core/service/version/endpoint commitment, not a verified registration or payment. The decisions endpoint makes bounded final public reads only when configured; default-disconnected is not a failure disguised as an empty history. Ask AI is unavailable unless separately configured and enabled.

Before recording a paid demo, compare actual chain ID, final contract code hash and account configuration with the intended WASM and role setup, run endpoint identity/conformance verification, then inspect the transaction/receipt and checked-output evidence. A server responding, a build passing or a screenshot cannot substitute for that sequence. Pending/uncertain attempts remain tied to their saved IDs and journals.

No browser interaction was performed for this environment preparation. Existing earlier UI captures are dated evidence, not a new rehearsal.
