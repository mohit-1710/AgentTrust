# Local AgentTrust MCP

Six tools expose the native NEAR SDK through the official MCP stdio transport. The server fixes one owner, session, network, core and endpoint catalog from a local operator file. It has no HTTP listener, owner-management tool, arbitrary signing method, file-reading tool or URL override.

| Tool | Input | Result |
| --- | --- | --- |
| `list_services` | optional `cursor`, optional `limit` (1–20) | Registered page with configured/eligibility labels |
| `get_service` | `serviceId` | Current registered identity or `null` |
| `get_policy` | `{}` | Fixed owner's policy or `null` |
| `preview_payment` | `quote`, `credential` (reference or `null`) | SDK decision with `authorization: not_proven_by_view` |
| `pay_service` | `serviceId`, `csvUtf8`, `paymentId` | Paid report, typed denial, failed payment, uncertainty or retrieval failure |
| `get_payment` | `paymentId` | Final-block settled/failed observation or explicit uncertainty |

All inputs reject unknown fields. Hashes and IDs use the existing canonical SDK formats; `paymentId` is a required canonical base64 32-byte value. CSV is explicit Unicode text bounded to 64 KiB of valid UTF-8. No tool reads an arbitrary local file. Service and report text is untrusted data, not instructions.

Results use `structuredContent: { result }` and matching JSON text. `McpToolResult` in `src/server.ts` exports the result union. A typed policy denial is a normal result and keeps its `preview`, `executed_rejection`, or `recorded_replay` origin. Only an executed rejection can include its real transaction/receipt evidence. Read failures use `isError: true` with `READ_FAILED`, distinct from `null` or a missing payment.

## Operator configuration and launch

Build from the repository root using the pinned local toolchain:

```sh
. scripts/env.sh
pnpm build:services
node dist/packages/mcp/src/run-server.js --help
```

The JSON below is a **configuration example**, not a deployed target or a payment authorization. Replace account names, session, origin and directory with the prepared environment. The file must be an absolute ordinary JSON file, at most 64 KiB; symlink files are rejected. Keep the file and journal outside Git.

```json
{
  "schema_version": 1,
  "network": "near:testnet",
  "core_account": "core.testnet",
  "rpc_url": "https://test.rpc.fastnear.com",
  "owner_id": "owner.testnet",
  "session_id": "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
  "attempts_directory": "/absolute/private/agenttrust-attempts",
  "catalog": [
    { "service_id": "merchant.testnet", "service_version": 1, "origin": "https://audit.example" }
  ],
  "credentials": [],
  "wait_timeout_ms": 10000
}
```

`credentials` is optional and contains public references shaped as `{ service_id, service_version, credential: { issuer_id, credential_id, revision } }`. Catalog and credential lists are bounded to 128 entries with unique service/version pairs. Catalog origins must be canonical HTTPS origins; the SDK checks the registered endpoint commitment before requesting a quote. Retain original catalog versions and the private attempt journal for historical report retrieval. The SDK creates its journal directory with mode `0700` and files with mode `0600`.

Configure the MCP host to launch the compiled Node entry directly:

```text
command: /absolute/path/to/pinned/node
args: ["/absolute/repo/dist/packages/mcp/src/run-server.js", "--config", "/absolute/private/mcp.json"]
```

`stdout` is MCP protocol only. Launching through ordinary `pnpm start:mcp` adds pnpm script banners; use the direct Node command for an MCP host. The convenience script can be run with `pnpm --silent start:mcp --config /absolute/private/mcp.json`.

Provide only the dedicated **`AGENTTRUST_WORKER_PRIVATE_KEY`** through the host's protected environment configuration when payment is intended. Never put a key in JSON, tool arguments, a trace, a command-line argument or Git. The worker key must be an ed25519 function-call key on the configured owner account, limited to `execute_payment` on the pinned core with a finite positive allowance. The SDK verifies this permission before signing/broadcasting and rejects full-access keys, other receivers/methods and unlimited allowance. Owner, deployment and issuer keys belong in separate processes and must never be inherited by this server. Use a role-specific environment allowlist; local HTTPS fixtures may additionally pass their explicit public CA file as `NODE_EXTRA_CA_CERTS`. Never disable TLS verification.

Without the worker variable, the server still starts and its read tools work. `pay_service` then returns `PAYMENT_NOT_CONFIGURED`; that is not evidence that an existing payment ID is unpaid. Key restrictions are checked on execution, while historical payment reads require no active key. This local process does not publish or host a signer.

## Retry contract

Only `pay_service` has money-moving annotations. Supply and retain one ID for an exact service/CSV attempt. The SDK persists the signed quote and one durable checkpoint before submission. Retrying uses those immutable records; it never automatically rebroadcasts or replaces the quote. Reusing the ID with changed input is refused. Do not delete the journal or change IDs to recover from an uncertain outcome.

`uncertain`, pending, not-found, a generic tool exception, or a failed output retrieval **never means unpaid**. Generic payment exceptions return sanitized uncertainty with the original ID; read/schema errors cannot establish nonpayment either. `retrieval_failed` retains the settled payment context and only sanitizes its error text. Use `get_payment` to inspect the original final state; it cannot submit, refund or retry. A preview cannot prove signer possession. Native receipts and finality still depend on the configured RPC; no light-client proof is claimed.

## Verification

```sh
. scripts/env.sh
pnpm exec vitest run packages/mcp/test
pnpm check:fast
pnpm test:mcp:stdio
```

The first two commands use pure values and ordinary temporary journal files. They do not start Sandbox or a database. The explicit stdio smoke builds the real CLI, launches it through the official MCP client and exercises initialize/list/all six calls against loopback mock RPC without a worker key. It writes a CSV-redacted protocol capture under ignored `artifacts/local/mcp/`; every capture identifies itself as mock-only. The MCP retry test runs the real SDK journal/provider handler with chain methods doubled, including lost-response recovery and changed-input refusal. These checks are not native payment or live-agent evidence. User-run native runtime evidence is a separate sprint gate.

Protocol implementation follows the pinned official [TypeScript SDK v1.29.0](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.29.0), using `McpServer`, `StdioServerTransport`, `Client`, and `StdioClientTransport`; no custom JSON-RPC transport is implemented.
