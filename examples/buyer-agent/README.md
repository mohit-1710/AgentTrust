# Buyer: checked invoice audit through local MCP

The buyer exposes the existing six local MCP tools to a bounded model loop. The host fixes the original CSV and one or two candidate service/payment ID pairs before the first model call. Model output can propose a call; host checks decide whether it is allowed. Successful model text is never payment or report evidence.

Two explicit modes share the same host checks:

- `near-ai`: actual NEAR AI Cloud chat completions with a caller-selected model and API key. A successful run can provide actual model/tool trace evidence. No such paid run has been executed during implementation.
- `scripted`: deterministic list/policy/purchase sequence for a reproducible scenario. Its output is labeled `scripted_harness_not_autonomous`. It can still move native funds when the real worker is configured; it is not a no-cost simulation.

When a job needs execution, both modes use the official MCP `Client` and `StdioClientTransport`, launching the compiled local AgentTrust MCP server. No owner/issuer management tool, generic signing, arbitrary model endpoint or alternative chain is added.

## Prepare, then explicitly execute

1. Finish the separate native/runtime and T18 preparation through B's credential issuance. Run fresh buyer jobs before T18 revokes B's credential or rotates its identity. Supply the prepared public MCP configuration, restricted worker key, provider catalog and credential references. Preserve the SDK's original attempt journal.
2. Use the offline command below with the existing `AGENTTRUST_DEMO_DIR` containing the completed `demo.json` and rendered `mcp.json`. It validates their exact shared bindings and writes the committed synthetic `mixed-validity` CSV into a private buyer configuration. The JSON contains explicit CSV text; do not include this file in a public trace or evidence upload. `buyer.example.json` documents the schema; its sample IDs and services are not a prepared run.
3. The command generates a fresh canonical base64 32-byte job ID and two payment IDs distinct from T18's IDs. Scripted and model runs get separate files and fresh IDs; do not change one job's mode to reuse it for the other. Keep the exact CSV, configuration and IDs for every recovery. `buyer-jobs` is inside the prepared demo directory; execution creates it as `0700`, or requires that mode and current-user ownership. Configurations/journals are private `0600` ordinary files, not a database. An existing buyer file is never overwritten.
4. For `near-ai`, choose an explicit model ID from the current [public model catalog](https://cloud-api.near.ai/v1/model/list), and provide `NEAR_AI_API_KEY` through a protected environment for execution only. The offline preparation accepts its identifier without contacting the catalog; the execution launcher verifies that the exact model is ready and advertises tool support. There is no invented default model. The [official quickstart](https://docs.near.ai/cloud/quickstart) documents the Cloud endpoint and Bearer authentication. Using the gateway alone is not an attestation or privacy-verification claim.
5. Provide `AGENTTRUST_WORKER_PRIVATE_KEY` through a protected environment, containing only the owner's restricted ed25519 function-call key. Never put either key in JSON, CLI arguments, logs, Git or model text. Model requests receive only the model API key in the authorization header. The MCP child receives only the worker variable, PATH and an explicitly supplied `NODE_EXTRA_CA_CERTS`, in addition to the official transport's ordinary platform defaults. Owner, issuer, provider and LLM credentials are excluded from that child. No TLS bypass is passed.

Build and read help without executing payment or inference:

```sh
. scripts/env.sh
pnpm build:services
node dist/examples/buyer-agent/src/run.js --help
node dist/examples/testnet-demo/src/buyer-config.js --help
```

Create the scripted configuration offline:

```sh
node dist/examples/testnet-demo/src/buyer-config.js --directory "$AGENTTRUST_DEMO_DIR" --mode scripted
```

For a separate model run, set the public `AGENTTRUST_BUYER_MODEL` variable to the chosen catalog ID, then prepare its configuration:

```sh
node dist/examples/testnet-demo/src/buyer-config.js --directory "$AGENTTRUST_DEMO_DIR" --mode near-ai --model "$AGENTTRUST_BUYER_MODEL"
```

These commands create `buyer-scripted.json` or `buyer-near-ai.json` exclusively, using the existing MCP file, provider A/B service IDs, eight model/tool steps and a 1,024 output-token limit per request. They need no role keys or model API key and make no network or signing call. A second invocation refuses the existing file; keep it for recovery. They do not check chain readiness or create a fresh rehearsal environment.

For localhost HTTPS providers, export the explicit CA in this buyer shell before execution; the MCP child receives it too:

```sh
export NODE_EXTRA_CA_CERTS="$PWD/.agenttrust/local-tls/localhost.crt"
```

The following is a **user-run execution command**. It can spend configured native testnet funds; `near-ai` mode also consumes billable model credits. Implementation checks do not run it:

```sh
node dist/examples/buyer-agent/src/run.js --config "$AGENTTRUST_DEMO_DIR/buyer-near-ai.json" --execute
```

Use `buyer-scripted.json` instead for the separately labeled scripted run. Do not run both concurrently with each other or with T18 captures.

`--execute` is mandatory for both modes. No startup/default/test command launches an actual model run. `max_steps` is 1–12 per invocation, `max_completion_tokens` is 1–4096 per request, one tool call per model response is permitted, and model HTTP calls have a 30-second timeout with no retry. `max_tokens` limits output tokens, not a guaranteed dollar budget; repeated invocations incur additional inference cost. The final JSON is a machine-checked report or a stopped outcome. The raw model's narrative is not printed as a successful result.

## Durable selection and stopping rules

Before any `pay_service` call, the host atomically publishes and fsyncs the selection. It forwards only the configured service, exact CSV and corresponding stable ID. The underlying SDK retains the signed quote and single transaction checkpoint; this layer never replaces that journal or automatically rebroadcasts.

An alternative candidate becomes eligible only after a validated `pay_service` result shows a definitive no-dispatch denial (`preview`, `executed_rejection`, or a replay of the original preview denial) or a final failed payment. Execution receipts are required only for an executed rejection; a preview does not get invented receipts. The alternative has its own preselected ID. A successful paid outcome is terminal and its report is independently checked against the original CSV, with owner/session/service/core/network/payment/request/invoice and final-state bindings checked by the host.

Uncertainty, pending, not-found, retrieval failure, errors, malformed output or a model boundary violation stop the invocation. No second supplier or new ID is attempted. Read tools alone never establish nonpayment or advance a selected attempt. A restart reloads the immutable context and selected original attempt before a model can choose anything. It can recover that same attempt using the same ID and SDK journal. Once a definitive paid outcome is persisted, subsequent invocations return it without another model or payment call. Concurrent identical calls also depend on the SDK's single-checkpoint semantics; no filesystem lock reset or stale-PID override is used.

Do not delete the journals, change CSV/IDs, or create a new job to work around an uncertain outcome. Changing the job's fixed config is a conflict. An unavailable/corrupt job record stops the buyer before dispatch. There is no reset or reconciliation authority in this CLI.

The CLI validates the same public config, immutable job context, original payment and checked report before requiring execution credentials. A saved terminal paid outcome can be replayed with the same command and files even when worker/model keys or network access are unavailable. Replay makes no model catalog, inference, RPC or payment call and starts no MCP child. It returns the saved checked outcome, not a fresh chain observation. An unfinished job still requires its worker key and, in `near-ai` mode, model key and catalog readiness before any model call. Keyless MCP `get_payment` can separately inspect the original payment on chain; it does not authorize a replacement purchase.

## Records and verification

For a configured `job_id`, `prefix = sha256(JSON.stringify(job_id))`. Under `job_directory`:

- `<prefix>.context.json`: immutable job/config/request fingerprints and candidate IDs; no raw CSV.
- `<prefix>.selection-0.json`, optionally `selection-1.json`: selected candidate indexes, durable before calling pay.
- `<prefix>.outcome-0.json`, optionally `outcome-1.json`: only validated definitive denials/failed/paid results. A paid outcome includes the useful checked report for the synthetic input. Uncertain outcomes do not create a definitive record.
- `<prefix>.run-<run_id>-NNN.json`: immutable timed trace events, source Git commit, config hash, explicit mode/evidence label, actual model request/response hashes and response ID when available, tool requests with CSV replaced by hash/size, result hashes and validated payment outcome summaries. Raw model prose/reasoning, raw errors, CSV, keys and authorization headers are not stored.

A `near-ai` configuration alone is not evidence of model execution. Final output preserves the configured `mode` and reports `model_responses`. Saved paid report replay has `evidence: "recorded_replay"`, `replayed: true` and zero model responses in either mode. Other `near-ai` invocations with no received model response are labeled `no_model_response_this_run`. Saved report replay does not manufacture a new agent session. These records depend on trusted local code/files and configured RPC; they are not cryptographic attestation of model behavior or a light-client proof of chain finality.

Safe implementation checks:

```sh
. scripts/env.sh
pnpm exec vitest run examples/buyer-agent/test
pnpm check:fast
pnpm test:buyer:stdio
```

Pure tests use temporary ordinary files, model-fetch doubles and MCP doubles. The explicit stdio smoke builds the real code and connects the compiled buyer to the compiled MCP server through the official transport and loopback mock RPC, with **no worker or model key**. It proves stopping and restart boundaries, not payment. Its redacted capture is explicitly mock-only under ignored `artifacts/local/buyer/stdio-mock-<timestamp>.json`. The same command also runs the actual compiled buyer CLI against checked mock saved outcomes under preloaded network/process denial guards: keyless replay, corrupt/context-conflicting records and unfinished missing-key stops. Native settlement, actual paid-provider success, actual model selection and final submission remain separate evidence gates.
