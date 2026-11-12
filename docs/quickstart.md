# Local quickstart

Start with local checks and read-only surfaces. No deployed account, signing key, paid API account or browser is needed for that path. A native paid purchase is a separate user-run handoff; a successful build or mock transcript does not establish one. See the [evidence map](evidence-map.md) for recorded results and remaining gates.

## 1. Prepare the pinned tools

Use Node **24.22.2**, pnpm **10.33.0**, Rust **1.97.1**, the `wasm32-unknown-unknown` target and an **OpenSSL CLI supporting `req -addext`**. The TLS tests invoke OpenSSL to create temporary local certificates. Install missing tools using your platform's normal setup before proceeding. `scripts/env.sh` selects existing project-local tools when present; it installs nothing. The [T02 toolchain record](sprint/toolchain.md) is a dated setup record, not the current command/status list.

From the checkout root:

```sh
. scripts/env.sh
node --version
pnpm --version
cargo --version
pnpm install --frozen-lockfile --ignore-scripts
pnpm check:fast
pnpm build:contract
pnpm build:services
pnpm test:mcp:stdio
pnpm build:surfaces
```

Expected: ordinary Rust/TypeScript tests and typechecking pass; the production WASM inspector reports `artifact_kind: production` and `executed: false`; services emit under `dist/`; web/docs builds finish. The MCP smoke starts the real compiled stdio process against **loopback mock RPC**, lists all six tools and writes a dated mock-only transcript under `artifacts/local/mcp/`. It supplies no worker key and sends no transaction.

These commands use local files and compiler/package downloads, not Sandbox or a database. Do not use an inherited Anchor test command, wildcard runtime test, or install lifecycle hook. Current executable commands are in [package.json](../package.json); `pnpm test:ui` is still an explicit not-ready entry, not a visual test pass.

## 2. Start the website and docs

Use two terminals after building:

```sh
# Terminal 1, from the checkout root
. scripts/env.sh
pnpm --filter web exec next start --hostname 127.0.0.1 --port 3000
```

```sh
# Terminal 2, from the checkout root
. scripts/env.sh
pnpm --filter docs-site exec next start --hostname 127.0.0.1 --port 3001
```

Read-only terminal checks:

```sh
curl --fail http://127.0.0.1:3000/api/decisions
curl --fail http://127.0.0.1:3001/api/ask
```

With no network configuration or assistant opt-in, expect `{"kind":"unconfigured"}` and `{"available":false}`. This is intentional. Static docs/search work without an LLM key. No command above opens a browser.

The public local-origin settings in [web/.env.example](../web/.env.example) are `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and `NEXT_PUBLIC_DOCS_URL=http://localhost:3001`. Hosted origins require a separate authorized deployment.

To observe an **actual prepared deployment**, set the following server-only values before starting the website. The angle-bracket values are deliberately incomplete templates, not existing accounts or a deployed environment:

```text
AGENTTRUST_NEAR_RPC_URL=<actual testnet RPC HTTPS URL>
AGENTTRUST_NEAR_CORE_ACCOUNT=<actual deployed core account>
AGENTTRUST_NEAR_OWNER_ID=<actual configured owner account>
```

Omit `AGENTTRUST_NEAR_DECISION_REFS` unless you have actual rejected-call transaction hashes for that owner. At most eight configured references are checked. The feed shows bounded final payment views plus verified configured refusals; it is not a full denial index. No private key belongs in website configuration. Unknown/pending state is never proof of nonpayment.

## 3. Providers and read-only MCP

For the two controlled providers, follow [local-demo.md](local-demo.md): complete public provider configs, an isolated localhost certificate, HTTPS origins `https://localhost:4041` and `https://localhost:4042`, and separate invoice-signing seeds. The [provider README](../examples/invoice-audit/README.md) defines the full config and routes. The named service/payout accounts and registered endpoint commitments must come from the actual prepared environment; localhost origins alone do not create registrations.

The [T18 runbook](testnet-demo-runbook.md#public-configuration-and-local-build) creates a public template and renders the complete provider/MCP configs. These two preparation commands do not send transactions; fill every required public binding before rendering:

```sh
pnpm --silent demo:prepare:testnet -- --template
pnpm --silent demo:prepare:testnet -- --render-config /absolute/private/demo.json
```

```sh
pnpm start:invoice-audit --help
pnpm start:invoice-audit --config /absolute/private/provider-a.json
# In another terminal, with provider B's own invoice seed:
pnpm start:invoice-audit --config /absolute/private/provider-b.json
```

Each provider receives only its own `AGENTTRUST_INVOICE_SEED_BASE64`, a dedicated 32-byte HTTP signing seed. `/health` reports `configured` and `chain_verification: not_checked`, not verified chain readiness. Local TLS clients use the explicit public certificate through `NODE_EXTRA_CA_CERTS`; never disable TLS verification or install a system-wide certificate for this demo.

Once all four public config files and TLS paths are ready, the [single-terminal launcher](local-demo.md#one-terminal-for-the-local-stack) can check and run both providers plus web/docs: `pnpm demo:local --check --directory /absolute/demo-directory`, then replace `--check` with `--start`. It uses separate provider A/B invoice-seed variables, checks configuration parity and free ports, and stops only its own children on Ctrl-C. It starts no browser, MCP client, model or chain operation. `pnpm test:local:stack` exercises the actual compiled listeners with temporary synthetic configuration after both surfaces have been built.

For an MCP host, create an absolute ordinary JSON file using real public deployment bindings. This minimal **read-only configuration template** has no provider catalog or credential claims:

```json
{
  "schema_version": 1,
  "network": "near:testnet",
  "core_account": "<actual deployed core account>",
  "rpc_url": "<actual testnet RPC HTTPS URL>",
  "owner_id": "<actual configured owner account>",
  "session_id": "<actual canonical base64 32-byte session ID>",
  "attempts_directory": "/absolute/private/agenttrust-attempts",
  "catalog": []
}
```

Replace every template value first. Point the host directly at the pinned Node executable with args `[/absolute/checkout/dist/packages/mcp/src/run-server.js, --config, /absolute/private/mcp.json]`. Use a role-specific environment allowlist and **omit `AGENTTRUST_WORKER_PRIVATE_KEY`** for read-only operation. The server uses stdin/stdout protocol; an ordinary `pnpm` banner is not valid MCP transport. [MCP documentation](../packages/mcp/README.md) covers host setup, the six tools and public service/credential catalogs.

Read calls can inspect registered services, the fixed owner's policy and final payment state. `pay_service` without the worker key returns `PAYMENT_NOT_CONFIGURED`; this says nothing about whether an old payment is paid. A preview never proves possession of a signing key. Use the earlier mock stdio smoke when no deployment exists.

## 4. Native and agent handoffs

These are separate from the local quickstart. Do not run them through an agent, default test hook or CI to bypass execution restrictions.

- **T13 native runtime:** follow [runtime-runbook.md](runtime-runbook.md). `pnpm check:runtime:compile` only compiles. The explicit user-run Sandbox command writes a local chain database; the agent cannot execute it. Inspect its recorded manifest and raw receipts afterward. Refund-gap/midnight and other matrix cases remain open; exit 2 means incomplete, not passed.
- **T18 testnet setup and purchase/refusals:** follow the [explicit testnet runbook](testnet-demo-runbook.md) using actual funded accounts. Operational `demo:prepare:testnet` / `demo:run:testnet` calls require `--user-run`, `--config`, a fresh `--output` directory and a named `--step`. Provider A has trusted identity but missing capability evidence; B is the validated paid provider. Inspect the production code hash, role setup, signed conformance, exact refusal/payment receipts, final state and checked output. The preparation is implemented; execution and acceptance remain pending. No reusable deployed accounts or keys are supplied.
- **T20 buyer:** the [implemented buyer runbook](../examples/buyer-agent/README.md) defines fixed job/candidate IDs, exact CSV, model bounds and the explicit `--execute` command. `pnpm test:buyer:stdio` checks the compiled loop and MCP against mock RPC without keys. The scripted path and actual model/tool loop are labeled separately. Real model calls and native purchases need their explicit run; source, mocked tests and scripted output cannot establish autonomous completion.

Keep one payment ID and the private immutable attempt journal for each exact service/input attempt. On uncertainty, missing state or retrieval failure, inspect that same attempt; do not delete the journal, change IDs, switch providers or repay automatically. Admission, settlement and output checking are distinct facts.

## Accounts, costs and keys

| Process/action | Prerequisites and cost boundary | Keys allowed |
| --- | --- | --- |
| Local builds, docs, mock tests | Tool downloads, disk/CPU; no chain funds or LLM API required | None |
| Website/read-only MCP/provider chain reads | A reachable RPC and actual deployment; provider quotas or charges depend on the selected RPC | No NEAR private key |
| Provider HTTP signing | Dedicated seed per provider; local hosting is not public availability | Its HTTP invoice seed and local TLS key only |
| Testnet preparation | Existing funded core, owner, issuer and two merchant accounts; actual payout accounts; funds for account/storage requirements, deployment/management gas and vault/worker allowances | Role-specific setup key in a separate setup process |
| Agent purchase | Restricted owner-account function-call key, exact core receiver and only `execute_payment`, finite positive gas allowance, funded vault | Worker key only in the local MCP signer process |
| Actual LLM buyer | Provider account/API key and available quota or credits; explicit model choice and buyer token/step limits | LLM API key only in the buyer process |
| Optional docs assistant | Separate server-side provider key plus `ASK_AI_ENABLED=true`; model requests may be billable. Leave disabled for this quickstart | Assistant API key only in the docs server |

Testnet NEAR amounts are demo configuration, not a fiat price or revenue. No current faucet quota, account price, RPC tariff, gas conversion or model pricing is verified here; check actual balances/provider terms before the separately authorized run. Never inherit owner/deploy/issuer keys into MCP, the buyer or browser bundle. Keep seeds, API keys, journals, raw user CSV and unreviewed captures out of Git.

The issuer and both providers are project-controlled; inputs under `fixtures/invoice-audit/v1/` are synthetic. The assertion covers a named bounded suite, not provider independence or general quality. The [upstream reuse boundary](../README.md#reused-baseline-and-new-work) preserves the original website/docs design and MIT notices; native authority/payment code and its evidence are new work. No current browser verification, two full rehearsals or completed native paid demo is implied by this quickstart.
