# NEAR core architecture and consequences for AgentTrust

As of 2026-11-10. Research and proposed architecture only. No deployment, funding, signing, state-changing RPC, or database-writing test was performed.

## Findings that determine the port

- NEAR's atomicity is receipt-local. A transaction has one receiver; actions targeting that receiver can roll back together. Cross-contract calls and native payout promises create independent asynchronous receipts. Three NEAR contracts cannot reproduce Solana atomic CPI composition. [N03–N05]
- Function-call keys restrict contract/method access, cannot attach NEAR, and have a **gas allowance**, not an asset spending allowance. AgentTrust still needs contract-enforced amount, token, recipient, and velocity limits. [N01–N02]
- A pre-funded vault permits a zero-deposit agent payment method. The contract spends its deposited assets after its own policy checks. Funding, treasury accounting, withdrawals, storage reserves, and recovery become real product requirements.
- `Allow` means authorization; it does not mean external payment completed. Expose pending and terminal settlement states. Root-transaction success alone can hide failed descendant receipts. [N04][N06]
- Readable named accounts do not establish service quality, independent reviewers, or personhood. Reputation provenance must be explicit.

## Live network and dependency snapshot

Read-only `status` and `EXPERIMENTAL_protocol_config` requests were made to `https://rpc.mainnet.near.org` and `https://rpc.testnet.near.org`. Both reported protocol **88**. Mainnet: nearcore **2.14.0**, commit `bc4e9e8cfb03d9e82f027883055624e18576993e`. Testnet: **2.14.0-rc.5**, commit `b7b4737cab46f17a6daa2ed694d7aebbd204363a`. Both configs reported:

```text
storage_amount_per_byte = 10000000000000000000 yoctoNEAR
max_total_prepaid_gas = 1000000000000000 gas = 1000 TGas
max_gas_burnt = 1000000000000000 gas = 1000 TGas
```

These are configuration observations, not benchmarks. Avoid stale 300-TGas maximum claims; measure the application route. [N08][N09]

Read-only package registry checks returned `near-sdk` **5.30.1**, `near-workspaces` **0.24.0**, `near-api-js` **7.4.0**, and `@hot-labs/near-connect` **0.12.0**. They were not built or compatibility-tested together. Current official docs use Rust for contracts, NEAR Connect for wallets, and current `near-api-js` APIs; sandbox tutorials now demonstrate `near-sandbox` plus `near-api`. Pin a compatible set and lockfiles during implementation. [N10–N13]

## Accounts, keys, and session authorization

A NEAR account has a stable account ID, multiple independently removable keys, and optionally a contract. Full-access keys can transfer funds, manage keys, deploy code, and delete the account. A contract-account full-access key therefore represents upgrade and asset-control authority. Subaccount naming is useful for display, not a security boundary by itself. [N01][N07]

Recommended direct-call MVP:

1. Human wallet controls funding, policies, session enrollment/revocation, withdrawal, and pause.
2. Agent gets a function-call key on the owner's account, restricted to `execute_payment` on the configured vault. Use an explicit method list, never wildcard permissions. Calls attach zero NEAR.
3. Vault requires `predecessor_account_id == signer_account_id`, authorizes the owner account, then matches `signer_account_pk` to the enrolled session, policy, expiry, and status. This deliberately excludes proxy/relayer calls until their own authentication path exists.
4. `predecessor` alone cannot distinguish several agent keys sharing the owner account. A direct-call key match or an independently authenticated session is necessary.
5. Administrative methods authorize the immediate account caller and require exactly one yoctoNEAR where suitable. Funding accepts its intended deposit. One yocto blocks ordinary function-call keys; it does not replace ownership checks. [N01][N14][N15]

The key allowance funds gas; the vault needs its own storage/operating reserve and deposited spend assets. Revocation stops future authorizations, not an already dispatched transfer.

NEP-366 relaying is optional later scope. The user signs a delegate action; the relayer submits and pays. In the inner call **predecessor is the user, signer and signer key are the relayer**. Authorizing a user session from `signer_account_pk` in that path is incorrect. A delegated function-call key still permits only an allowed zero-deposit function call. Current protocol rejects `DelegateV2`: the inner delegate must use a regular access key, although the outer relayer transaction can use a gas key. [N16][N17]

For relayed sessions, use a distinct authorized session account or verify an enrolled session's domain-separated signature over the full payment intent: network, contract, owner/session, token, recipient, integer amount, invoice/payment ID, challenge hash, policy version, expiry, nonce. Wallet login and service invoice signatures are not buyer payment authorization. NEP-413 is suitable for login challenges, with account-key verification and challenge consumption. [N18; recommendation]

Gas keys add prepaid gas and parallel nonce lanes, not an asset policy engine. Keep them outside the first demo; serialize nonce allocation per ordinary agent key. [N02; recommendation]

## Settlement alternatives and recommendation

External calls can interleave with other public methods before callbacks. The caller, external transfer, and callback each commit separately. Returning the correct promise chain improves status reporting but does not introduce distributed rollback. [N03–N05]

| Mode | Atomic part | Separate part | Consequence |
|---|---|---|---|
| Internal treasury ledger | Local policy/identity/validation/reputation, buyer debit, merchant internal credit, receipt | Deposits and withdrawals | Real one-receipt settlement of a contract-held claim, **not** an external wallet transfer |
| Native NEAR payout | Local checks, nonce consumption, reserve/debit, operation record, transfer scheduling | Native Transfer receipt, then callback/feedback | Smallest external-payment route; asynchronous states and recovery required |
| NEP-141 payout | Same local authorization/reservation | FT transfer on token contract, callback/feedback | Stablecoin-compatible design, but extra registration/deposit/decimals/gas dependencies |

**Recommendation:** a single shared configurable testnet vault for the hackathon, with logical Rust modules for policy, sessions, identity/capability validation, settlement, and receipts. Keep load-bearing data local for synchronous decisions. Start with native NEAR external payouts and honest pending states; gate FT support behind a completed native failure-path demo. The later [feature specification](09-feature-spec.md) replaces the initial five-policy preservation assumption with explicit owner service permission and scoped capability evidence; separate logical modules do not require three deployed contracts.

Shared vault custody must be disclosed: an operator-controlled upgrade/full-access key can replace code and drain assets. Tenant accounting and agent key restrictions do not stop that operator. Do not describe the prototype as trustless or production custody. A per-user vault reduces pooled balance/tenant impact but adds factory/deployment/storage work. It only removes operator upgrade power if its actual authority is user-owned or code is immutably pinned; global-contract references by account ID can remain updatable. [N01][N07; recommendation]

An SDK precheck followed by a plain wallet transfer is bypassable and does not enforce policy. A batch cannot atomically call a gate on one account and transfer FT on another. A cross-contract reputation query can be stale by execution time. External attestations need explicit issuer trust, freshness, and revocation rules. [N03][N05][N19; inference]

## External-payment state machine and recovery

Proposed identity: canonical hash of domain, network, contract, owner/session, invoice ID, token, recipient, amount, challenge hash, and expiry. A session nonce prevents replay. A payment-ID lookup returns the original operation on retries; the same ID with different fields must fail.

```text
Unseen -> Rejected
       -> PendingTransfer -> Settled
                          -> TransferFailed
                          -> NeedsReconciliation
```

At dispatch, validate caller/session, pause, signed invoice/expiry, token and recipient, available funds, policy counters, capability validity, and reputation freshness. Reserve balance and limits **before** the outgoing promise. Store policy version and exact charged time-window bucket. A successful callback observing a definitively failed transfer releases the original reservation, not an unrelated current day's/week's bucket. If the callback itself fails, retain the reservation. Pending commitments count against limits even when a window rolls over according to the defined policy; otherwise many payments can be dispatched near the boundary. Define fixed-window or rolling-window semantics precisely. [N21; recommendation]

Private callbacks finalize only their matching pending operation, exactly once. They never issue another payout. Payment feedback is emitted only after the expected transfer succeeded; it records payment execution, not service quality. External-call failure returns attached native funds to the contract, not automatically to the original user's application balance. Restore the correct owner claim once. [N22][N23]

**Refund timing matters:** a failed Transfer action's refund can be a separate in-flight receipt. Restoring a user's ledger claim is not proof the contract already has the liquid funds. Track refund receivables/uncertainty and verify actual current liquid NEAR before another dispatch or withdrawal. Do not subtract dispatched payments a second time when the runtime already debited them; use the conservative accounting formulation in the refinement below. Never infer real balance from the ledger alone. For FT, external token balance and token-specific behavior also need reconciliation. [N04][N09][N23; design inference]

**Successful payout plus failed callback is the critical case.** Money may already be at the merchant while the vault still says pending. Callback failure reverts only callback state; it does not revert the transfer or automatically retry the callback. Therefore:

- Never release a reservation or reissue a payment because a timer elapsed, the frontend disconnected, or RPC returned unknown.
- API retries return the same operation and poll its original transaction/receipt chain.
- Preserve network, transaction hash, original signer, outgoing receipt identity when available, token, recipient, amount, and operation linkage. An unrelated successful transaction or balance delta is insufficient.
- Backend can inspect the expected finalized transfer receipt even if the callback failed. A contract cannot trust an off-chain RPC response without an explicit verification/oracle design.
- On-chain recovery requires verified receipt evidence or a clearly permissioned resolver attesting to that exact outgoing outcome. An operator's assertion plus evidence hash is **not trustless**. Bound its authority and make it visible in docs.
- MVP may safely leave uncertain operations locked as `NeedsReconciliation`, accepting limited liveness. If implementing recovery, it only finalizes accounting based on the original outcome; it does not redispatch the original payout. Do not claim production recovery without failure-path execution evidence. [N24; recommendation]

A merchant may confirm the finalized external payout from the original receipt chain while local feedback remains unresolved; report those two facts separately. Payment success does not prove delivery. Do not add escrow, arbitration, refunds for poor output, or quality guarantees merely to hide that distinction.

## Tokens and stablecoin constraints

NEP-141 tokens are balances in their issuing contract. Standard `ft_transfer` and `ft_transfer_call` require exactly one yoctoNEAR; tagged `near-sdk-v5.30.1` source enforces it at lines 122–136. An ordinary function-call key cannot directly attach that deposit; a funded vault can call the token contract with its own funds. NEP-145 provides storage registration. Query the token's bounds and account registration; do not hard-code one price for all tokens. Both vault and merchant must be registered as that token requires. [N19][N25][N26]

`ft_transfer_call` changes balances on the FT contract, invokes recipient `ft_on_transfer`, then resolves unused funds. It is not general atomic rollback across downstream contracts. The recipient validates predecessor as the allowed token contract and uses `sender_id` for the depositor. Zero returned means all used; the full amount means all unused. Refunds are bounded by the original amount and the recipient's remaining balance. For vault funding, credit only accepted token-contract namespaces; for simple payout prefer `ft_transfer` unless the recipient needs the handshake. [N19][N27]

Use Rust `u128`, JSON amount strings, and JS `bigint`, never floating-point balances. Token identity is network plus contract ID, not symbol. Testnet mock dollars are not redeemable stablecoins; do not label a mock as Circle-issued USDC or assume mainnet contracts share testnet addresses. No stablecoin deployment/address was verified in this subtask.

## Gas, storage, events, and UI

Allocate measured gas for the external call and bounded callback, with margin. The maximum is a protocol limit, not a safe default or latency boost. Storage growth locks contract balance; bound session lists, policies, operation records, and attestations, and specify who pays. Removing old replay IDs without an expiry/nonce design can re-enable replay. [N08][N09; recommendation]

Use structured NEP-297-style events for authorization, dispatch, success/failure, and feedback. An authorization event is not a settlement event. Deduplicate indexed events by network, contract, receipt ID and event index, check successful outcome context, and retain direct chain views for indexer outages. [N28; recommendation]

For the simplest defensible demo, request `wait_until: "FINAL"`, verify the final execution status, and inspect the expected successful receipt outcomes. `INCLUDED_FINAL` only finalizes transaction inclusion, while later receipts may still be unfinished. An RPC timeout means unknown, not failed. Poll the saved hash. Typical block/finality time is not the end-to-end settlement SLA. Existing UI design can remain, but needs checking/pending/settled/failed/reconciliation behavior. [N06]

Hosted MCP should remain read-only. Local MCP holds the user's limited session key; never solve UX with one operator key signing for every user. Owner wallet login can use NEP-413 with fresh, expiring, consumed challenges and account-key verification. [N18; recommendation]

## Acceptance plan and unverified work

No following tests were run. Under the standing database restriction, NEAR Sandbox creates persisted chain/database state: do not execute it without an applicable exception or one-time override. Pure in-memory policy/state-model tests can be used after verifying the harness does not write a database.

| Test | Pass condition |
|---|---|
| Agent key calls forbidden method / attaches deposit | Protocol rejects; no spend |
| Agent calls allowed method outside policy | Contract rejects; no spend |
| Wrong caller/session/network/token/recipient/amount or stale capability | Reject before payout |
| Concurrent payments below individual cap but above combined budget | Combined reserved/settled total cannot exceed permitted budget |
| Retry after timeout / duplicate API request | Same operation, no second payout or feedback |
| Transfer fails (missing recipient or FT registration) | Correct claim/reservation restored once; refund-in-flight cannot create false liquidity |
| Transfer succeeds, callback fails or runs out of gas | No refund/retransfer; unresolved state retained until evidence-based reconciliation |
| External or duplicate callback | No forged/duplicate accounting |
| Limit window rolls over before result | Correct original bucket accounting; pending spend cannot evade limit |
| Pause/revoke/update during pending transfer | Defined dispatch-time semantics; already dispatched payment never treated as canceled |
| Wrong FT invokes deposit receiver | No accepted-asset credit |
| Owner withdraws with pending payment | Reserved and uncertain funds unavailable |
| Low gas/storage reserve | Safe failure; no false settled receipt |
| Indexer unavailable / duplicate events | Chain view remains available; no double charge or credit |

A node-based sandbox is needed to validate receipt/callback behavior; unit tests alone cannot establish network execution. Current official docs demonstrate `near-sandbox` and `near-api`, while `near-workspaces` remains an available library. Registry availability is not successful integration. [N13]

Unverified: proposed contract execution, live wallet/session behavior, token address/issuer identity, application gas/latency, receipt-proof recovery, and compatibility of the current dependency versions together.

## Source register

Official primary documentation and source opened during this run unless otherwise indicated. Documentation establishes documented behavior; design recommendations are inference from those primitives, not existing implemented capabilities.

- N01 — [Access Keys](https://docs.near.org/protocol/accounts-contracts/access-keys): receiver/method permissions, gas allowance, full-access authority.
- N02 — [Nearcore Access Keys](https://near.github.io/nearcore/DataStructures/AccessKey.html): gas keys, permissions, nonce lanes, delegate restrictions.
- N03 — [Transaction Anatomy](https://docs.near.org/protocol/transactions/transaction-anatomy): one receiver, ordered actions, receipt-local atomicity.
- N04 — [Transaction Lifecycle](https://docs.near.org/protocol/transactions/transaction-execution): receipts, rollback scope, descendant-status caveats.
- N05 — [Cross-Contract Calls](https://docs.near.org/smart-contracts/anatomy/crosscontract): asynchronous independent calls.
- N06 — [Blocks and Finality](https://docs.near.org/integrations/blocks-and-finality): final execution milestones and expected successful receipt outcomes.
- N07 — [Account Model](https://docs.near.org/protocol/accounts-contracts/account-model): account IDs, keys, optional contract.
- N08 — [Gas](https://docs.near.org/protocol/transactions/gas), [RPC Protocol configuration](https://docs.near.org/api/rpc/protocol), and live read-only network snapshot above. Protocol-configuration page was identified from the official index; the actual configuration was read directly from RPC.
- N09 — [Storage](https://docs.near.org/protocol/storage/storage-staking): storage balance, growth attacks, measurement.
- N10 — [Rust SDK](https://docs.near.org/tools/sdk), [near-sdk registry](https://crates.io/api/v1/crates/near-sdk): official SDK and 5.30.1 snapshot.
- N11 — [API Libraries](https://docs.near.org/tools/near-api), [near-api-js registry](https://registry.npmjs.org/near-api-js/latest): current APIs and 7.4.0 snapshot.
- N12 — [Wallet Connector](https://docs.near.org/tools/near-connect), [NEAR Connect registry](https://registry.npmjs.org/@hot-labs%2Fnear-connect/latest): wallet path and 0.12.0 snapshot.
- N13 — [Sandbox Testing](https://docs.near.org/smart-contracts/testing/integration-test), [near-workspaces registry](https://crates.io/api/v1/crates/near-workspaces): test capabilities and 0.24.0 snapshot.
- N14 — [Environment](https://docs.near.org/smart-contracts/anatomy/environment): predecessor, signer, signer key, deposit.
- N15 — [Require One YoctoNEAR](https://docs.near.org/smart-contracts/security/one_yocto): deposit-capable key checks, ownership checks.
- N16 — [Meta Transactions](https://docs.near.org/protocol/transactions/meta-tx), [NEP-366](https://github.com/near/NEPs/blob/master/neps/nep-0366.md): relayer/user context. Raw NEP lines 51 and 196 explicitly confirm relayer signer/public key.
- N17 — [Nearcore Actions](https://near.github.io/nearcore/RuntimeSpec/Actions.html): function-call delegates require zero deposit; DelegateV2 removal.
- N18 — [Backend Authentication](https://docs.near.org/web3-apps/backend/backend): NEP-413 challenge and key verification.
- N19 — [NEP-141](https://github.com/near/NEPs/blob/master/neps/nep-0141.md): FT standard, asynchronous state/freshness caveat.
- N21 — [Balance Deduction](https://docs.near.org/smart-contracts/security/cross-contract-calls/reentrancy): reserve/debit before an outgoing transfer.
- N22 — [Private Callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks): own-contract callback authorization.
- N23 — [Refund NEAR](https://docs.near.org/smart-contracts/security/cross-contract-calls/refunds): failed external call returns deposit to contract.
- N24 — [Callbacks Can Fail](https://docs.near.org/smart-contracts/security/cross-contract-calls/callback-failures): callback failure, no automatic retry, bounded work, recovery.
- N25 — [FT core implementation, near-sdk-v5.30.1](https://github.com/near/near-sdk-rs/blob/near-sdk-v5.30.1/near-contract-standards/src/fungible_token/core_impl.rs): tagged raw source inspected; lines 122–136 enforce one yoctoNEAR.
- N26 — [NEP-145](https://github.com/near/NEPs/blob/master/neps/nep-0145.md), [FT Integration](https://docs.near.org/integrations/fungible-tokens): registration and metadata.
- N27 — [FT Transfer Call Security](https://docs.near.org/smart-contracts/security/cross-contract-calls/ft-transfer-call): token predecessor and bounded refunds.
- N28 — [Contract Events](https://docs.near.org/smart-contracts/anatomy/events): NEP-297 structured event conventions.

Actual read methods: web opens to the linked official pages; raw GET of tagged FT implementation and NEP-366; GET package registry endpoints; RPC `status` and `EXPERIMENTAL_protocol_config` with finality `final`. No signed transaction was constructed or sent.


## Final refinement: native liquidity equation and on-chain invoice verification

Pinned nearcore source at the observed mainnet commit confirms `ExecutionResultState` initializes current balance from account balance plus attached deposit; `deduct_balance` subtracts value attached to outgoing promises; the host `account_balance` getter returns that current balance. SDK `env::account_balance` is an uncached host call. Thus an outstanding payment record does **not** imply its amount remains in the contract's liquid balance. Sources: [execution balance state and subtraction](https://github.com/near/nearcore/blob/bc4e9e8cfb03d9e82f027883055624e18576993e/runtime/near-vm-runner/src/logic/logic.rs), [host balance getter](https://github.com/near/nearcore/blob/bc4e9e8cfb03d9e82f027883055624e18576993e/runtime/near-vm-runner/src/logic/host.rs), [tagged SDK host wrapper](https://github.com/near/near-sdk-rs/blob/near-sdk-v5.30.1/near-sdk/src/environment/env.rs). This is source inspection, not a receipt-level experiment.

A conservative recommended equation for a one-payout-per-method native MVP is:

```text
B = env.account_balance(), sampled before constructing this method's outgoing promises
S_post = conservative reserve for all storage after this method's writes commit
O = explicitly funded operating reserve, unavailable to owner payouts
A = aggregate available, withdrawable claims across all owners before the new payout
x = proposed payout

Require owner.available >= x
Require B >= S_post + O + A
Then atomically debit owner.available and A by x, reserve the operation, and schedule x.
```

`A` includes every other liquid refundable claim or earmark, or those claims must appear as additional explicit liabilities on the right-hand side. It excludes already dispatched payment reservations: their native value has already left `B`, and the owner was debited at dispatch. After scheduling, `B` and `A` both fall by `x`; subtracting all pending payments again would double-count them. A successful callback recording a definitively failed transfer can restore `A` before the refund receipt returns, temporarily breaking the full-backing condition and blocking new payouts/withdrawals until the actual balance recovers. A callback that itself fails cannot commit that restoration. Do not add a refund receivable to `B`. An unknown outcome keeps its owner's amount reserved; returned surplus is never automatically credited to that owner without matching evidence. This conservative global liquidity gate may delay another tenant during a refund in flight; the limitation is explicit and avoids inventing per-tenant liquidity from pooled cash.

The equation assumes no other outflows between the sample and scheduling. Keep that method to one payout; if constructing several promises, account only for new outflows after the sample. Rust `Promise` construction may defer host scheduling until it is consumed/dropped, so do not assume a prior Rust expression already reduced the host balance. `S_post` must cover cached collection changes and final contract serialization, using a proven upper bound or explicit flush/measurement; current `storage_usage` alone can miss unflushed writes. No native staking is in scope. Receipt-level and storage-growth tests remain required before this equation is claimed implemented correctly.

**Merchant invoice verification can be mandatory on chain.** Tagged `near-sdk` 5.30.1 provides `env::ed25519_verify(signature: &[u8; 64], message: impl AsRef<[u8]>, public_key: &[u8; 32]) -> bool`, invoking the host verifier in WASM. [Tagged SDK source, `ed25519_verify`](https://github.com/near/near-sdk-rs/blob/near-sdk-v5.30.1/near-sdk/src/environment/env.rs#L688).

Recommended refinement: enroll the merchant's raw Ed25519 invoice key through merchant-controlled registration; the contract selects that stored active key, never a caller-supplied trust root. Verify fixed-version canonical bytes containing domain, actual network and contract, merchant/service identity, payout account, asset and amount, invoice/payment ID, request/resource commitment, expiry, nonce, and any buyer/session restriction. Fail on altered fields, unregistered/revoked key, wrong domain, expiry, malformed signature length, or replay. Check policy on the exact verified tuple. This establishes invoice authenticity and binding, not delivery quality. It is a research proposal; no signature verification code or test was executed.
