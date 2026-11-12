# Verification contract

Verification requirements frozen 11 November 2026. Actual task results are recorded in the sprint ledger. Source inspection, a test file existing, compilation and a passing runtime test are different evidence. T01/T02 verify provenance and toolchain smoke checks. T03/T04 establish V05 local Rust/TypeScript byte agreement and signature/input cases described in the ledger. No runtime gate has passed.

**Execution update, 12 November:** the user authorized the current testnet operations and granted the standing rule's one-time exception for local native verification. [Actual Sandbox evidence](../native-runtime-evidence.md) now records 19 passing groups, with refund-gap and midnight/edit ordering still open. [Testnet evidence](../testnet-r2-evidence.md) records native payments and a scripted MCP purchase. These observations do not complete G2–G4; the lane rules below describe the original planning boundary, not a prohibition on this explicitly authorized work.

## Lanes and execution

| Lane | What it establishes | Current execution rule |
|---|---|---|
| D: pure Rust domain | Encoding, deterministic policy and accounting over ordinary in-memory values | May run during implementation; no database/runtime |
| H: Rust contract memory host | Actual contract methods, serialized storage and recorded promise actions through SDK map-backed host | Explicit isolated `tests/contract-memory` suite; ordinary Rust maps/vectors only, no database/chain. Context and promise results are supplied; no WASM/rollback/receipt execution proof. |
| T: pure TypeScript/HTTP | Client byte agreement, parsing, tool schemas, request/receipt checks | May run if effects are inspected and no database/live mutation |
| W: WASM build | Contract compiles for target | May run; does not establish runtime correctness |
| U: UI/docs | Visual preservation, truthful data mapping, generated corpus | Local/read-only smoke allowed; no auto-deploy |
| R: runtime | Actual NEAR key restrictions, receipts, storage/balance/refund behavior | Sandbox persists database: prepare exact command, user executes under standing rule |
| L: live demo | Actual testnet purchase and hosted service behavior | Outside planning authorization; separate reviewed execution and evidence |

Never put R/L into default install/build/test scripts, postinstall hooks, GitHub Actions or scheduled jobs. A prepared user-run harness is not a passed gate. No approval prompt can waive the standing prohibited-write rule; provide the command for user execution instead.

## Acceptance matrix

| ID | Assertion / expected observation | Lane | Task |
|---|---|---|---|
| V01 | Only contract deployment authority initializes; no public bootstrap race | D,R | T05,T13 |
| V02 | Worker key can invoke only exact core `execute_payment`, cannot transfer, manage keys or call owner methods | R | T05,T13 |
| V03 | Wrong owner/key/predecessor, revoked/expired session and relayed context cannot dispatch | D,R | T05,T13 |
| V04 | Worker cannot select weaker profile/revision or manufacture management authority with zero deposit | D,R | T05,T08,T13 |
| V05 | Rust/TS encode identical canonical invoice/descriptor bytes including large amounts | D,T | T03,T04 |
| V06 | Registered-key signature accepted; any bound-field/domain mutation rejected | D,T,R | T04,T10,T13 |
| V07 | Expired/overlong/future-invalid invoice and malformed binary fields reject | D,T,R | T03,T04,T10 |
| V08 | Payout/key/endpoint/version changes invalidate old service permission and capability | D,R,L | T07,T08,T18 |
| V09 | Owner block beats trust; unknown service has no automatic trial/approval route | D,R | T08,T13 |
| V10 | Required credential wrong issuer/subject/scope/suite/revision, missing, expired or revoked prevents dispatch | D,R,L | T07,T08,T16,T18 |
| V11 | Empty required issuer set is invalid; merchant trust does not grant issuer privilege | D,R | T07,T08 |
| V12 | Exact purchase/day cap allowed; +1yocto denied; all sessions share owner daily capacity | D,R | T08,T09,T13 |
| V13 | Two requests cannot reserve beyond cap/available balance; pending from previous day stays counted | D,R | T09,T13 |
| V14 | Five dispatches fill fixed-minute count; failure retains count; denials/previews/replays do not charge it | D,R | T08,T09,T13 |
| V15 | Policy/profile edit and midnight never reset pending liabilities or charge callback to wrong day | D,R | T09,T11,T13 |
| V16 | Available claims/storage credits/operating funds backed under actual Promise deduction and final serialized storage | D,R | T06,T10,T13 |
| V17 | Definitive failure restores claim once; until actual refund returns, backing rule blocks new transfer | D,R | T09,T11,T13 |
| V18 | Transfer success + callback failure stays pending/reserved; timeout never refunds/resends | D,R,L | T11,T13,T17 |
| V19 | Private/fake/repeated callbacks cannot double-finalize or fabricate success | D,R | T11,T13 |
| V20 | Same owner/paymentID/tuple returns original operation; changed tuple conflicts across restart, including SDK changed CSV/service arguments | D,T,R,L | T10,T13,T17,T19 |
| V21 | Owner withdrawal excludes pending/storage/operating funds, goes only to owner, handles failure once | D,R | T12,T13 |
| V22 | Record/cursor/input bounds enforced; one actor cannot exhaust another's credited storage | D,R | T06,T07,T13,T14 |
| V23 | Read-only preview proves no key possession and consumes no counters/state | D,T,R | T08,T14 |
| V24 | Mere transaction inclusion/HTTP200/RPC hash cannot release paid content; final settled binding required | T,R,L | T14,T17,T18 |
| V25 | Wrong asset/amount/payee/network/core/request receipt cannot buy content; settled original receipt remains redeemable after quote expiry or service registry rotation using its immutable invoice/catalog binding | T,L | T17,T18 |
| V26 | SDK saves exact signed attempt before broadcast; write failure prevents send; crash/restart/not-found after uncertain broadcast never silently replaces quote or ID | T,L | T17,T19,T20 |
| V27 | Endpoint fresh signed descriptor matches registered identity; nonce/version/key/payout mismatch and redirects rejected; conformance endpoint permits only committed public fixtures | D,T,L | T04,T16 |
| V28 | Suite identity pinned separately from run evidence; credential only asserts documented bounded checks | D,T,U | T07,T16,T28 |
| V29 | Audit golden cases: CSV quoting/newlines, vendor+invoice duplicates, invalid/negative amounts, currencies, exact totals | T | T15 |
| V30 | Paid report binds exact input bytes and matches manually checked expected result | T,L | T15,T18 |
| V31 | MCP exposes no arbitrary signing/file paths/URLs, owner management or shared full-access signer; configured service/version origin must match registry hash before HTTP | T,source | T14,T19 |
| V32 | Agent adapts to typed refusal, completes actual task, and stops on unresolved payment | T,L | T20,T27 |
| V33 | UI distinguishes approved/credential-valid/paid/output-checked; preview/executed-rejection/replay origin and pending state truthful | U,L | T21,T23,T27 |
| V34 | All active website copy/media/metadata plus docs, generators, search and assistant context describe native facts, with old proof claims removed | U,source | T22,T24,T25,T28 |
| V35 | Fresh reader reproduces useful result and attack refusal from documented commands/evidence | R,L,U | T28 |

## Evidence artifact

Runtime/demo manifests identify: UTC capture time; git commit; tool/dependency versions; chain/network; core account and code hash; actor role/account and public key fingerprint only; operation ID and immutable invoice hash; expected decision; actual transaction ID and relevant receipt IDs; final contract payment state; raw amount/asset; request/output hashes; executed command; exit status; case assertions and limitations.

Include redacted raw public RPC outputs supporting the specific receipt/state assertions. Do not record private keys, auth tokens, environment dumps, sensitive user CSVs or a whole account credential directory. Use synthetic data. Keep unreviewed output under ignored `artifacts/local/`; explicitly stage only reviewed public evidence.

The manifest must distinguish `passed`, `failed`, `not_run`, `user_run_required`, `recorded_replay` and `unavailable`. A screenshot or transaction hash alone is insufficient proof. A checker reading old evidence must label its capture time; it cannot turn a replay into a new live result.

## Gate policy

- G1 codec: V05–V07 pure vectors pass before any real signing/deployment.
- G2 authority/money: V01–V04,V12–V23 runtime cases pass before claiming safe native spending.
- G3 trust/service: V08–V11,V24–V30 pass before claiming the complete supplier-selection purchase.
- G4 product: V31–V35 pass; core flow rehearsed twice; no open Critical/Important issue.
- G5 submission: baseline/new-work boundary, actual checks, known custody/liveness limits and controlled demo actors disclosed; user reviews concrete package before external release/submission.

Critical/Important defects get a focused regression check and repair before the relevant gate. Minor off-path issues enter the ledger. Callback uncertainty remains an explicitly documented prototype limitation, not something to conceal or repair by an unverified refund.
