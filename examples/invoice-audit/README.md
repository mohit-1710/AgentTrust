# Native NEAR invoice audit provider

This is the controlled `invoice.audit.v1` service for the AgentTrust demo. It audits CSV structure, duplicate vendor/invoice pairs and integer currency totals. Totals include valid duplicate rows and are **not payable amounts**. This is a custom `agenttrust-http402-v1` protocol, not standard x402-exact support.

The implementation has local unit, filesystem-failure and loopback HTTP checks. A native paid task still requires the separate user-run contract/runtime gate and T18 evidence. These checks do not establish live-chain settlement or public service availability.

## Build and run

From the repository root:

```sh
. scripts/env.sh
pnpm build:services
pnpm start:invoice-audit --help
```

The build emits executable JavaScript and copies the exact public conformance fixtures into `dist/`. It does not start a listener, database or chain. The source package is private; no npm publication is implied.

The explicit listener command is `pnpm start:invoice-audit --config /absolute/provider.json`. It expects a dedicated 32-byte Ed25519 invoice signing seed in `AGENTTRUST_INVOICE_SEED_BASE64`. This is an HTTP invoice key, not an owner, issuer or worker chain key. Do not put it in JSON, Git or a browser bundle. The service uses a signer-free NEAR reader and cannot move funds.

The operator's public JSON configuration has `schema_version:1`, `network:"near:testnet"`, `core_account`, `rpc_url`, `port` (1024–65535), `offer`, and optional `retained_offers`. An offer contains:

```text
service: {service_id, version, payout_account, invoice_key, endpoint_hash, active}
origin: canonical HTTPS origin
amount_yocto: positive integer decimal string
```

The listener binds `127.0.0.1`. Its configured HTTPS origin must be routed by the operator's HTTPS reverse proxy. The code does not deploy or configure that proxy. Keep old public identity/origin versions in `retained_offers` and the buyer catalog so previously settled content remains retrievable after rotation. Redemption checks the signed original price against the settled receipt; changing the currently advertised price does not invalidate it.

## Routes and evidence

- `POST /v1/identity-challenge`: the T16 nonce-bound signed descriptor.
- `POST /v1/conformance`: only a committed fixture ID; arbitrary uploaded CSV is rejected.
- `POST /v1/invoice-audit`: `mode:"quote"`, `csv_utf8`, and the owner/session/payment/profile/policy `context` produce HTTP402 with a signed quote. Public context supplies bindings, never authority.
- The same audit route with `mode:"redeem"`, original `csv_utf8`, `quote`, submitted `credential` and `{tx_hash,sender_account_id}` transaction locator returns a report only after the provider independently resolves the exact call at `FINAL` and reads matching `settled` contract state at a final block. The entire canonical invoice hash binds network, core, owner, session, profile/policy, service/version, payout, request, asset, amount and dates. Expiry limits dispatch, not retrieval.

The buyer additionally verifies its own final observations and independently checks the returned report semantics. Returned transaction/receipt IDs and final-block metadata are RPC evidence, not a light-client proof. A provider's successful HTTP response alone is insufficient. The provider recomputes the report and keeps no uploaded-data store or payment database.

HTTP JSON bodies are bounded at512KiB (including escaped CSV); decoded CSV remains64KiB. JSON responses are bounded at8MiB to accommodate worst-case per-row rejection output. Unsupported methods/paths/content types and redirects are rejected.

## Buyer configuration and crash behavior

`AgentTrustClient` accepts optional `purchase:{ownerId,sessionId,attemptsDirectory,credentials?,waitTimeoutMs?}` alongside its existing catalog and restricted worker configuration. `credentials` is an explicit list of `{service_id,service_version,credential:{issuer_id,credential_id,revision}}`. Catalog membership and a configured credential do not grant permission; contract preview and execution still decide.

`client.payService({serviceId,csvUtf8,paymentId})` requires a stable canonical32-byte base64 payment ID. It returns `paid`, `denied`, `failed`, `uncertain`, or `retrieval_failed`; it does not choose another supplier or generate an ID. A `denied` response identifies `preview`, `executed_rejection`, or `recorded_replay` with `original_origin:"preview"` for a saved local refusal. Only an executed rejection has actual transaction evidence. A saved refusal is not presented as a fresh policy observation.

The absolute attempt-directory parent must exist. The SDK creates the leaf with0700 permissions and ordinary immutable JSON files with0600 permissions. It stores the exact signed quote, original credential and public binding data, never CSV or private keys. Files and directories are fsynced before broadcast; symlinks, insecure modes, malformed files and conflicting same-ID context fail closed. Concurrent creators use create-if-absent hard-link publication and adopt the winning quote.

A single immutable checkpoint slot holds either a preview refusal or the exact transaction locator. A concurrent refusal therefore cannot permit supplier switching while another process broadcasts. Only the process that durably creates the locator sends it. Later calls observe that same locator; they never rebroadcast, re-quote or silently repay. A crash after checkpoint creation but before the actual send leaves that attempt uncertain, including after quote expiry. Preserve the journal; deleting it is not a recovery mechanism. This conservative prototype has no automatic checkpoint reset or force-retry operation.

An interrupted response after payment can be recovered through the original attempt. Changed CSV/service under that ID conflicts. Missing journal for an already-existing chain payment stays uncertain. Settled retrieval/output-check failures stay `retrieval_failed`; they do not authorize another purchase. A caller may select a separately identified new attempt only after a definitive no-dispatch refusal or a finalized failed payment, never from `uncertain`.
