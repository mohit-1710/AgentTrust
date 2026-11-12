# Frozen architecture: AgentTrust on NEAR

Status: planning baseline, 11 November 2026. No implementation or runtime validation is claimed. Product semantics come from [the feature specification](../../research/agenttrust-near/09-feature-spec.md); native custody and accounting rationale come from [the technical blueprint](../../research/agenttrust-near/05-blueprint.md). This document fixes names and boundaries for the sprint tasks.

## 1. Build boundary

One native Rust contract on NEAR testnet; one native asset (`NEAR`); one direct agent-key authorization path; one custom AgentTrust HTTP 402 route; one capability (`invoice.audit.v1`); two controlled service identities; signer-owned local MCP; preserved website/docs design. The existing UI is reused, not counted as new NEAR implementation.

Core unknown-service behavior is strict denial. Exact one-off owner approval is outside the core sprint and has no placeholder method, UI switch or `RequireApproval` response. It may enter only after the complete core demonstration passes and the remaining clock permits its full specification/tests. No tiers, risk scores, social trust, FT, Intents, MPC, TEE, escrow, global blacklist, arbitrary policy language or new admin dashboard.

The owner funds contract custody; the worker holds only a function-call key on that owner's NEAR account. It can call only `execute_payment` on this contract with zero attached deposit. A contract session pins that actual signing key to exactly one owner-selected profile/revision. Full-access owner and deployment keys are never available to the agent/MCP process.

```text
Owner wallet / owner CLI -> native core: funding, policy, sessions, trust, blocks
Merchant account       -> native core: versioned service identity
Issuer account         -> native core: scoped credential issue/revoke
Local agent -> local MCP / SDK -> core.execute_payment -> native transfer
                                      |                     |
                               reserve first          private callback
                                      |                     |
                                      +---- payment view ---+
Local agent -> paid API: signed quote / settled receipt / actual report
Existing web/docs -> read-only contract/RPC data and recorded evidence
```

The shared contract operator's upgrade/full-access authority is a disclosed trust assumption. No production custody or immutable deployment claim. No relayer or NEP-366 path in this version. The contract's configured testnet domain and actual current account ID must match invoices and SDK configuration.

## 2. Files and responsibilities

These are target paths, not claims that the files exist. Keep `web/` and `docs-site/` at their upstream locations to minimize visual churn. `docs/sprint/` contains planning records only.

| Path | Single responsibility |
|---|---|
| `Cargo.toml` | Workspace containing domain and contract crates |
| `crates/agenttrust-domain/src/types.rs` | Canonical invoice, profile, decision and accounting DTOs with checked units |
| `crates/agenttrust-domain/src/codec.rs` | Versioned Borsh bytes and domain hashes |
| `crates/agenttrust-domain/src/policy.rs` | Pure ordered evaluation from explicit snapshots; no environment, storage or network |
| `crates/agenttrust-domain/src/accounting.rs` | Pure reserve/settle/fail state transitions and time-bucket arithmetic |
| `contracts/agenttrust-core/src/lib.rs` | Public ABI, initialization and contract state layout |
| `contracts/agenttrust-core/src/authority.rs` | Direct-call actor authentication and registered signing-key checks |
| `contracts/agenttrust-core/src/owner.rs` | Funding, storage credit, policy/profile/session/trust/block management |
| `contracts/agenttrust-core/src/registry.rs` | Account-owned service revisions and issuer-authenticated credentials |
| `contracts/agenttrust-core/src/payments.rs` | Mandatory invoice verification, authoritative evaluation, reservation and native dispatch |
| `contracts/agenttrust-core/src/callbacks.rs` | Private bounded transfer/withdrawal result handling |
| `contracts/agenttrust-core/src/views.rs` | Bounded read-only queries and non-authoritative preview |
| `contracts/agenttrust-core/src/events.rs` | Versioned NEP-297 event schema; no secret/input-body logging |
| `packages/near-sdk/src/types.ts` | TypeScript wire DTOs matching Rust JSON |
| `packages/near-sdk/src/codec.ts` | Same canonical Borsh encoding/hash rules as Rust |
| `packages/near-sdk/src/client.ts` | Read-only queries and locally signed zero-deposit worker transaction |
| `packages/near-sdk/src/directory.ts` | Operator-configured service/version to HTTPS origin catalog; hash-check against registered identity before requests |
| `packages/near-sdk/src/attempts.ts` | Private local JSON attempt files; exact signed quote persisted before broadcast, with no database engine |
| `packages/near-sdk/src/pay-service.ts` | Quote binding, preview, execute, final receipt verification and paid response |
| `packages/near-sdk/src/finality.ts` | Poll actual transaction/receipt and final contract state; timeout remains uncertain |
| `packages/near-sdk/src/owner.ts` | Separate explicit owner management helpers; not loaded into worker MCP |
| `packages/mcp/src/server.ts` | Stdio local worker/read tools; no hosted signer or arbitrary signing tool |
| `examples/invoice-audit/src/server.ts` | Stateless quote/identity/paid-report HTTP routes |
| `examples/invoice-audit/src/audit.ts` | Actual CSV structural audit and exact decimal totals |
| `examples/invoice-audit/src/validate.ts` | Endpoint identity challenge and capability conformance runner |
| `examples/invoice-audit/src/check-output.ts` | Output verification against input/golden fixtures |
| `examples/buyer-agent/src/run.ts` | Reproducible buyer tool loop and inspectable decision trace |
| `fixtures/protocol/v1/` | Shared unsigned bytes, signatures, hashes and rejection vectors |
| `fixtures/invoice-audit/v1/` | Public synthetic CSVs and manually checked expected JSON |
| `tests/runtime/` | Planned access-key/receipt/refund/callback integration cases, subject to execution restrictions |
| `web/`, `docs-site/` | Reused visual shells; replace Solana facts and feed adapters with honest NEAR data |

The pure domain crate is the only deliberate boundary beyond deployment components: it makes money arithmetic and canonical encoding testable without a chain/database runtime. Do not add a generic registry framework, event bus, policy DSL or background indexer.

## 3. Frozen wire types and canonical invoice

JSON amounts and timestamps use unsigned decimal strings: `U128String` for yoctoNEAR, `U64String` for Unix nanoseconds/counters. Revisions use bounded u32 integers. In canonical invoice/descriptor JSON, small numeric fields accept finite integral parsed values in range (1,1.0 and1e0 have the same Borsh encoding; -0 encodes0). Money and timestamps still require strict decimal strings. No floating-point money or JavaScript number conversion of U128/u64 values. Account IDs undergo native NEAR validation. Profile IDs are nonempty UTF-8 strings of at most64 bytes, with no normalization; the same bound applies in Rust and TypeScript. Hashes and Ed25519 key/signature bytes use canonical padded base64 in JSON and fixed-size byte arrays inside Borsh.

```ts
type AccountId = string;
type Hash32 = string;              // base64, exactly 32 decoded bytes
type PublicKey32 = string;         // Ed25519, exactly 32 bytes
type Signature64 = string;         // Ed25519, exactly 64 bytes
type U128String = string;
type U64String = string;

interface InvoiceV1 {
  schema_version: 1;
  network: "near:testnet";
  core_account: AccountId;
  owner_id: AccountId;
  session_id: Hash32;
  payment_id: Hash32;             // fresh nonce; owner-namespaced idempotency key
  policy_revision: number;
  profile_id: string;
  profile_revision: number;
  service_id: AccountId;          // v1: one registered service per merchant account
  service_version: number;
  payout_account: AccountId;
  endpoint_hash: Hash32;
  request_hash: Hash32;
  asset: "NEAR";
  amount_yocto: U128String;
  issued_at_ns: U64String;
  expires_at_ns: U64String;
}
interface SignedInvoiceV1 { invoice: InvoiceV1; signature: Signature64 }
interface CredentialRef { issuer_id: AccountId; credential_id: Hash32; revision: number }
interface CapabilityRequirement {
  capability_namespace: "invoice.audit";
  capability_version: 1;       // together: invoice.audit.v1
  conformance_suite_version: number; // nonzero u32
  conformance_suite_hash: Hash32;
  accepted_issuers: AccountId[];      // 1–4 unique accounts
}
interface ExecutePaymentArgs { quote: SignedInvoiceV1; credential: CredentialRef | null }
```

`payment_id` is the nonce; do not add a second ambiguous nonce field. The contract stores `(owner_id, payment_id) -> invoice_hash + immutable payment record`. Same key and same invoice hash returns saved state without dispatch; different hash returns `PAYMENT_ID_CONFLICT`. The credential reference is evidence checked on a new admission, not a way to change what an existing invoice paid for.

Canonical invoice bytes are `ASCII("AGENTTRUST_NEAR_INVOICE_V1\0") || Borsh(InvoiceV1 fields in the exact order above)`. Network, asset, account IDs and profile ID use Borsh UTF-8 strings; hashes use 32 raw bytes; `schema_version` uses u8; revisions use little-endian u32; amounts use little-endian u128; timestamps use little-endian u64. Ed25519 signs these bytes directly. `invoice_hash = SHA256(canonical_bytes)`. The current registered service key verifies it; a key supplied alongside a quote is never a trust root.

The first endpoint commitment is the UTF-8 bytes of `agenttrust-http402-v1\nPOST\n<canonical HTTPS origin>\n/v1/invoice-audit\n`; hash with SHA-256. Canonical origin has lowercase ASCII hostname, no userinfo/query/fragment, no trailing slash and no explicit default port. Reject cross-origin redirects. An explicitly labeled local fixture mode may use localhost HTTP outside hosted/testnet demonstration claims.

`request_hash = SHA256(ASCII("AGENTTRUST_INVOICE_AUDIT_REQUEST_V1\0") || raw CSV bytes)`. Every quote and paid response binds those exact bytes. Input limit is 64 KiB. No normalization before hashing; the auditor's parsing rules are separate.

Quote default validity is 120 seconds; maximum signed invoice lifetime is 300 seconds. Contract acceptance requires `issued_at <= block_time + 5 seconds`, `expires_at > block_time`, and `0 < expires_at - issued_at <= 300 seconds`. The five-second tolerance bounds clock skew; it does not extend expiry. The owner setup defaults a session to 24 hours and the NEAR function-call key gas allowance to 0.5 NEAR. Those are labeled demo settings, not measured safe production limits. Gas allowance is a spending limit on transaction fees charged to the key's account, not prepaid gas or a vault-purchase allowance; the owner account still needs gas funds.

The endpoint challenge response has a separate `IdentityDescriptorV1` signature domain and exact Borsh field order:

```text
ASCII("AGENTTRUST_NEAR_IDENTITY_V1\0") || Borsh(
  schema_version: u8 = 1,
  network: string = "near:testnet",
  core_account: string,
  challenge_nonce: [u8;32],
  service_id: string,
  service_version: u32,
  payout_account: string,
  endpoint_hash: [u8;32],
  invoice_key: [u8;32],
  issued_at_ns: u64,
  expires_at_ns: u64
)
```

The validator generates a fresh random challenge nonce for each validation run and sends it to the pinned endpoint. It checks exact nonce, registered key/service/version/payout/endpoint, network/core, signature and dates using the same 120-second default, 300-second maximum and five-second skew tolerance. Descriptor key bytes must match the registry key; they are not self-authenticating. A retry within that run may accept the same descriptor until expiry; a new run requires a new nonce, and expired responses require a fresh challenge. Recheck that the registry version has not changed before issuing the credential. Include the verified descriptor hash in the evidence manifest. Descriptor and invoice signatures cannot substitute for one another because their domains and field schemas differ.

Shared vectors include one valid signature plus single-field mutations of owner, service, payout, profile, amount, network, contract, request, expiry and revision. Include integers above JavaScript's safe-number boundary, UTF-8, maximum-length account IDs and truncated/oversized binary fields. Matching Rust/TypeScript bytes is required before first signing.

## 4. State and scope

| State | Key / essential fields |
|---|---|
| Account ledger | Account ID; spendable available claim; unused storage credit; payment pending total; storage usage charged to this actor |
| Owner policy | Owner ID; revision; paused; owner-wide daily cap; maximum dispatches per 60-second bucket |
| Purchase profile | Owner + profile ID; revision; optional capability requirement containing namespace/version, suite version/hash and accepted issuer IDs |
| Session | Owner + session ID; actual signing public key; active/revoked; expiry; one profile ID/revision; per-purchase cap |
| Service identity | Merchant account ID; version; payout; invoice Ed25519 key; endpoint hash; active |
| Owner service trust | Owner + service ID; exact version; payout/key/endpoint hashes; permitted profile IDs; optional expiry; active |
| Blocks | Owner + service ID, and owner + payout account; active booleans |
| Credential | Issuer + credential ID; revision; service ID/version; capability namespace/version; suite version/hash; evidence-manifest hash; issue/expiry; revoked |
| Payment | Owner + payment ID; invoice/hash; session/profile/policy revisions; dispatch day/window; amount; state; dispatch time; credential reference used |
| Counters | Owner + UTC day settled-dispatch total; owner current minute bucket/count; all-day unresolved payment total |
| Withdrawal | Owner + withdrawal ID; fixed destination=owner; amount; pending/succeeded/failed state |

V1 hard bounds: 8 sessions, 4 profiles, 4 accepted issuers per required profile, 32 approved services, 32 service blocks and 32 payout blocks per owner; 32 issued credentials per issuer; 8 outstanding transfers (payments plus withdrawals) and 128 retained payment records per owner. Return a typed capacity error; no automatic pruning or receipt deletion in the demo build. These bounds are deliberate prototype limits, not scale claims. Pagination returns at most 20 items.

Each session has exactly one profile/revision. Updating a profile makes old-revision sessions unable to dispatch until the owner rebinds them. All owner mutations affecting authorization increment the owner policy revision. Invoices must use the current revision; already-dispatched records remain readable and callbacks retain their original accounting context. Owner/session/profile changes never reset money counters.

A new account ledger starts with policy revision 0, paused and zero spending limits; setup must explicitly configure it. Profile versions begin at 1. Session IDs are immutable: changing a session's key/profile/expiry requires owner revocation and a new session ID. At most one active session may use the same signing key for an owner. This makes key-to-profile authority unambiguous while preserving old payment records.

`register_session` is create-only and rejects an existing session ID. There is no hidden upsert/rebind API: after a profile revision changes, the owner calls `revoke_session(old_id)` and then `register_session(new_id, ...)`; reusing the same protocol key is allowed only after its old session is revoked. This is the one explicit rebind path in the CLI and tests.

Service updates increment identity version; an old trust entry or capability cannot follow a changed endpoint, key or payout. The service account controls its own record; registration is not owner trust. Credential issuance authenticates the issuer and never makes the issuer a merchant approval authority. A required capability with zero accepted issuers is rejected at configuration and fails closed at execution.

## 5. Public ABI and role checks

The signatures below are JSON-facing contract interfaces; exact Rust wrapper types may adapt NEAR SDK `U128`, `U64`, `AccountId` and `PublicKey` without changing wire meaning. Every mutation is bounded. Owner IDs are derived from the authenticated direct caller rather than accepted as mutation authority.

```text
new(network: "near:testnet", operating_reserve_yocto: U128String) -> void
deposit(storage_credit_yocto: U128String) -> AccountLedgerView
set_policy(expected_revision: u32, daily_cap_yocto: U128String,
           max_dispatches_per_minute: u32, paused: bool) -> OwnerPolicyView
set_profile(profile_id: string, expected_revision: u32|null,
            requirement: CapabilityRequirement|null) -> ProfileView
register_session(session_id: Hash32, public_key: NearPublicKey,
                 profile_id: string, profile_revision: u32,
                 purchase_cap_yocto: U128String, expires_at_ns: U64String) -> SessionView
revoke_session(session_id: Hash32) -> SessionView
set_service_trust(service_id: AccountId, service_version: u32,
                  allowed_profile_ids: string[], expires_at_ns: U64String|null,
                  active: bool) -> TrustEntryView
block_service(service_id: AccountId, blocked: bool) -> void
block_payout(payout_account: AccountId, blocked: bool) -> void
set_service(expected_version: u32|null, payout_account: AccountId,
            invoice_key: PublicKey32, endpoint_hash: Hash32, active: bool) -> ServiceView
issue_credential(credential_id: Hash32, expected_revision: u32|null,
                 assertion: CredentialAssertion) -> CredentialView
revoke_credential(credential_id: Hash32) -> CredentialView
execute_payment(quote: SignedInvoiceV1, credential: CredentialRef|null) -> ExecutionResult
withdraw_available(withdrawal_id: Hash32, amount_yocto: U128String) -> WithdrawalView
on_payment_result(owner_id: AccountId, payment_id: Hash32) -> PaymentView        [private]
on_withdrawal_result(owner_id: AccountId, withdrawal_id: Hash32) -> WithdrawalView [private]
```

- `new`: once only; authenticated contract-account deployment authority, no arbitrary first caller initialization. Network and operating reserve are immutable in this demo ABI.
- Owner management: `predecessor == signer`, direct caller owns the records, and attached deposit equals one yoctoNEAR. This rules out function-call keys that cannot attach a deposit, in addition to their method allowlist. One yocto goes to operating funds, not spendable principal. Funding is the payable exception: `deposit` uses direct actor authority and splits attached funds into explicit storage credit and spendable claim, charging initial actor-record storage from that credit. Existing actors may top up either portion.
- Worker execution: zero attached deposit; `predecessor == signer`; signer account is invoice owner; actual `signer_account_pk` matches the stored session. No caller-chosen labels replace these checks. Validate all active authority rules for new dispatch. Public receipt views handle historical inspection when a key is removed or expired.
- Merchant mutation: same direct/one-yocto requirements, service ID is caller account. Caller cannot modify another service. New registration starts at version 1; update requires expected current version and increments it.
- Issuer mutation: same direct/one-yocto requirements, issuer ID is caller account; issue/revoke only own credentials. Issuer funds its own storage credit. The assertion references an existing exact service version and valid bounded dates.
- Callbacks: `predecessor == current_account` and exactly one expected promise result; only current Pending record can finalize. No signer/owner/issuer parameter can grant callback authority. Duplicated callback processing is idempotent; public fake-callback attempts fail.
- Withdrawal: owner-only, destination fixed to that owner, available funds only, unique owner-namespaced ID, same backing/reserve/callback discipline. It does not spend the worker's daily purchase budget.

Session registration does not add a NEAR account key. The owner CLI/wallet performs the separate key-install action with receiver set to this core account, method list exactly `["execute_payment"]`, finite gas allowance and no full-access worker credential. Contract session revocation and protocol key removal are separate owner actions; both are represented honestly.

## 6. Decisions, accounting and asynchronous outcomes

```ts
type Decision =
  | { kind: "allow" }
  | { kind: "deny"; code: DenialCode; retry_after_ns?: U64String }
  | { kind: "require_validation"; code: CredentialFailure; requirement: CapabilityRequirement };
type ExecutionResult =
  | { kind: "rejected"; decision: Exclude<Decision, {kind: "allow"}> }
  | { kind: "payment"; payment: PaymentView; duplicate: boolean };
type PaymentState = "pending" | "settled" | "failed";
type PaymentDisplayState = PaymentState | "needs_reconciliation";
```

Authorization failure returns a fixed error or typed rejection and never consumes spending capacity. Business rule denials return normally so their NEP-297 decision event can persist; never claim a panicking receipt saved an event. Rejected calls may still cost gas. No on-chain per-denial history allocation; the live feed reads transaction outcome/events, while `list_recent_payments` lists dispatched records only. Historical replay feeds must be labeled.

Frozen ordering: authenticate and exact-ID lookup; active session/profile/policy/domain; canonical invoice signature/service version/payout/request; owner blocks; purchase/day/attempt/balance/storage/backing limits; capability issuer/subject/scope/suite/expiry/revocation; owner exact service trust; atomic reservation and dispatch. Preview uses the same pure evaluator but carries no execution authority and can go stale.

Fixed denial codes: `UNAUTHORIZED`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `PAUSED`, `PROFILE_MISMATCH`, `POLICY_CHANGED`, `DOMAIN_MISMATCH`, `INVALID_INVOICE`, `INVOICE_EXPIRED`, `IDENTITY_CHANGED`, `BLOCKED_SERVICE`, `BLOCKED_PAYOUT`, `PURCHASE_CAP`, `DAILY_CAP`, `RATE_LIMIT`, `INSUFFICIENT_FUNDS`, `INSUFFICIENT_BACKING`, `STORAGE_CREDIT`, `CAPACITY`, `UNKNOWN_SERVICE`, `PAYMENT_ID_CONFLICT`. Validation codes: `MISSING`, `UNACCEPTED_ISSUER`, `WRONG_SUBJECT`, `WRONG_SCOPE`, `WRONG_SUITE`, `EXPIRED`, `REVOKED`, `REVISION_CHANGED`. Public previews may include multiple explanatory failures; authoritative execution uses this order and one primary result.

At new payment admission:

```text
settled amounts originally dispatched in current UTC day
+ all unresolved payment reservations across every day
+ new amount <= owner daily cap
```

Reserve before scheduling. Store original UTC day and minute bucket. Native transfer success moves reservation into settled amount for its original dispatch day. Definitive transfer failure removes monetary reservation and restores owner's available claim exactly once. Attempt count remains consumed even after failure. Fixed 60-second windows admit a possible boundary burst; no rolling-limit claim. Policy edits, midnight and duplicate requests cannot discard liabilities or reset the owner-wide aggregate.

Aggregate backing must follow the runtime's actual scheduled-balance deduction, not double-subtract pending transfers:

```text
A = aggregate spendable available claims of every account
L = aggregate unused actor storage credits (not spendable)
B = runtime account_balance at the real execution point
S_post = conservative storage stake required after this bounded operation
O = immutable operating reserve plus any other nonspendable liability

Admission requires owner.available >= amount AND B >= S_post + O + L + A.
Then debit owner.available and A; persist reservation; actually schedule transfer.
```

Storage growth charges the responsible actor's storage credit: reduce that actor's credit and `L` by the priced bytes as storage stake increases. Charge bounded callback/receipt finalization capacity at dispatch so finalization never depends on a new user deposit. No tenant's records consume another tenant's credit. Since SDK collection/root serialization and Promise construction can be lazy, the implementation must establish conservative post-state storage and actual host scheduling with runtime tests; do not substitute an unmeasured before/after sample as proof. Accounting views distinguish spendable money, pending payments and storage credit.

A failure callback may restore a claim before the refund receipt returns actual NEAR. Each new transfer or withdrawal checks actual `B` against post-outflow storage stake, reserve and aggregate claims; it is refused when that balance is insufficient, including a refund gap with no other surplus. Uncommitted surplus may still back a safe outflow before the refund arrives. Never count a refund receivable as liquid money. A successful payout followed by callback failure leaves the record Pending and its allowance reserved; no automatic refund, resend or admin finalization shortcut.

After 120 seconds, an unresolved Pending record's **view** may display `needs_reconciliation`. This is a diagnostic label, not a storage transition or financial release. A late valid callback can still finalize it. V1 has no general historical-outcome proof verifier or reconciliation authority; unresolved records can remain locked. This liveness limitation must appear in the README and UI detail view.

## 7. Read API, SDK, MCP and the paid service

```text
get_config() -> CoreConfig
get_account(account_id) -> AccountLedgerView|null
get_policy(owner_id) -> OwnerPolicyView|null
get_profile(owner_id, profile_id) -> ProfileView|null
get_session(owner_id, session_id) -> SessionView|null
get_service(service_id) -> ServiceView|null
get_credential(issuer_id, credential_id) -> CredentialView|null
get_payment(owner_id, payment_id) -> PaymentView|null
list_services(cursor, limit<=20) -> Page<ServiceView>
list_recent_payments(owner_id, cursor, limit<=20) -> Page<PaymentView>
preview_payment(quote, credential) -> PreviewResult
```

All views are read-only. `preview_payment` evaluates claimed owner/session data but cannot prove possession of the worker key; `PreviewResult` explicitly says `authorization: "not_proven_by_view"`. The write method checks the actual signer. Service-list membership means registration/discovery, not owner approval.

```ts
interface AgentTrustClient {
  previewPayment(args: ExecutePaymentArgs): Promise<PreviewResult>;
  executePayment(args: ExecutePaymentArgs, options?: BroadcastOptions): Promise<SubmissionResult>;
  resolveSubmission(transaction: TransactionLocator, args: ExecutePaymentArgs): Promise<SubmissionResult>;
  getPayment(ownerId: AccountId, paymentId: Hash32): Promise<PaymentView | null>;
  awaitPayment(ownerId: AccountId, paymentId: Hash32, timeoutMs: number): Promise<PaymentObservation>;
  payService(args: {serviceId: AccountId; csvUtf8: string; paymentId: Hash32}): Promise<PaidAuditResult>;
}
```

`SubmissionResult` preserves the transaction locator on uncertainty. A final call result wraps the on-chain `ExecutionResult` plus matching receipt IDs; its admission record may still be pending. The optional `beforeBroadcast` hook checkpoints the known transaction locator before a single send. Recovery matches the exact submitted invoice, signature and credential reference. These T14 details preserve the settlement boundary rather than treating a successful RPC call as a paid result.

`awaitPayment` timeout returns uncertainty with the existing operation ID. `payService` requires a caller-supplied stable payment ID for the purchase attempt. The buyer keeps it across retries/restarts. Before broadcasting, the SDK durably saves the exact signed quote, selected credential reference, owner/network/core, service/version, request hash and payment ID in an ordinary local JSON attempt file under a configured private directory (0700 directory/0600 files, no database engine). Do not store private keys or CSV content. Use atomic create-if-absent publication for the immutable attempt and ensure persistence succeeds before broadcast. Failure to save stops submission. An existing attempt with different immutable context is a conflict, never overwritten.

On timeout/restart, load that exact attempt and query its original ID. If outcome is unknown, `not found` is not proof the broadcast cannot still execute. Resume observation or rebroadcast only the identical quote/ID; do not fetch a replacement invoice, switch suppliers or generate a fresh ID automatically. An expired unresolved quote remains uncertain until an authoritative terminal result is established. A definitive non-dispatch rejection or failed transfer can be surfaced to the caller for a separately identified new attempt; never silently treat an unknown result as that evidence. Deliberately fresh IDs remain budget/rate constrained, not semantically deduplicated.

Before resuming any existing payment or releasing/retrieving output, compare its stored owner, network, core, service, immutable invoice hash and request hash against the requested operation and saved attempt. A same-ID call with another CSV/service is an SDK conflict, not success for the old purchase. A settled receipt remains redeemable for its original bytes after invoice expiry; expiry limits new dispatch, not retrieval. Retrieval failure never changes a settled payment into an unpaid one or triggers repayment.

An endpoint hash is not a discovery URL. V1 SDK configuration contains an explicit bounded catalog keyed by `(service_id, service_version)` with canonical HTTPS origin for the two controlled providers. For a new quote/purchase, verify that catalog commitment against the current registered identity before HTTP requests. For an already-settled purchase, verify the retained old catalog entry against its immutable settled invoice, not the registry's now-current version. Keep those old catalog versions for completed-result retrieval; missing origin or mismatched version/hash returns `ENDPOINT_UNCONFIGURED`/`ENDPOINT_MISMATCH` without payment or repayment. No arbitrary URL argument, registry-provided redirect or general crawler is introduced. `list_services` labels registered, configured and policy-preview eligibility separately; catalog inclusion never grants owner payment permission.

The seller verifies final settled state against the full invoice/request binding, using a pinned network/core and final RPC state. Record matching execution/receipt evidence; RPC response trust is not a light-client proof. Returning an already purchased report for identical input is allowed; receipt reuse cannot buy changed input.

Local MCP tools: `list_services`, `get_service`, `get_policy`, `preview_payment`, `pay_service`, `get_payment`. All mappings use the SDK; `pay_service` is the only money-moving tool and accepts service ID, explicit CSV content and stable payment ID, not arbitrary raw transactions or arbitrary local file paths. Owner management is a separate CLI/wallet process. Hosted MCP, if included, is read-only. No hosted signer, full-access worker key or generic `sign` tool.

Paid API routes: `POST /v1/identity-challenge` returns a challenge-signed identity descriptor; `POST /v1/invoice-audit` takes CSV content plus owner/session/payment/profile/policy context and without a valid receipt returns the signed HTTP 402 quote. With a matching settled receipt it returns the real report. Context fields are public binding data, not server-granted authority. Repeated input/receipt deterministically recomputes the same result; no database, payment cache or durable uploaded-data store is needed. Reject unsupported body sizes and cross-origin redirects. SDK endpoint resolution uses the registered identity pinned by owner trust.

The validator obtains the fresh identity challenge, checks its exact service/version/key/payout, runs the named fixture suite, records a separate evidence manifest hash and issues the scoped credential. To avoid requiring an existing capability credential before it can be tested, a public `POST /v1/conformance` accepts only a named committed fixture ID, loads those fixed public bytes, and runs the same audit engine used by the paid route. It cannot accept arbitrary CSV or access paid user input. The validator compares actual endpoint results to manually checked golden values and records the descriptor, fixture/suite and result hashes. This tests bounded fixture behavior and identity; it is not runtime attestation that an untrusted provider uses the same implementation for arbitrary purchases. Owner profile pins suite/schema identity. Demo issuer and controlled providers are explicitly disclosed. The contract cannot observe HTTP ownership, liveness or output quality; those are issuer/client checks. Define the CSV grammar and manually checked expected fixtures before making conformance claims.

Decision evidence has an explicit origin: `preview`, `executed_rejection`, or `recorded_replay`. An SDK that stops at preview cannot fabricate a transaction/denial receipt. The attack demonstration includes a separately executed direct worker call with invalid evidence to prove the authoritative method rejects it; that actual receipt is linked. Only dispatched payments appear in payment history.

The buyer's repeatable test harness may be scripted, labeled as such. The presentation may show an actual agent invoking the same MCP tools and selecting among providers. LLM output never changes policy, authorizes a payout or supplies its own credential authority.

## 8. Verification boundaries and change control

Pure tests: canonical Rust/TypeScript byte vectors; policy precedence; profile downgrade rejection; identity/scope/issuer mismatch; checked U128 arithmetic; reserve/settle/fail/duplicate transitions; day rollover and policy edits. These tests operate on ordinary values and must not initialize a database or chain runtime.

Runtime tests still required: actual function-call key restriction; signer/predecessor context; attached-deposit management boundary; native dispatch and failed-refund ordering; successful transfer plus failed callback; lazy Promise deduction/post-serialization storage; two near-concurrent reservations; final receipt/service verification. Pure tests do not establish these host behaviors. Minimal `get_config`, `get_account`, `get_policy`, `get_session` and `get_payment` views must exist with the core tasks before T13; T14 adds the broader read API, SDK/finality integration and pagination. Tests must not depend on undeclared private storage layout.

Standing restrictions prohibit Sandbox/database writes in this session. Prepare runtime tests and exact user-run commands; do not execute a prohibited runtime through an alternate tool, subprocess, CI workflow or agent. No deployment, funding or remote mutation follows from this architecture document. The parent sprint plan records authorized execution separately.

Reopen architecture only for an observed correctness/security failure, unavailable required API, material integration evidence or a deadline-driven cut. Log the decision, evidence, affected tests and cost. An unimplemented convenience or competitor feature does not reopen scope. No silent transition to direct-wallet advisory checks or synthetic credential/risk scores.

Unresolved empirical gates are concrete: native backing/refund/serialization ordering; restricted-key runtime behavior; signature/encoding agreement; and full paid-service finality verification. These are first-build acceptance gates, not reasons to add broader research or more features.
