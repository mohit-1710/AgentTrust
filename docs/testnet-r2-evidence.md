# Testnet r2: native payment and MCP qualification

**12 November 2026, captures 16:27–16:33 UTC.** This run establishes production-contract testnet refusals, two native service payments, an exact native duplicate submission, a scripted MCP buyer flow, a saved-result replay and the website's HTTP decision feed. It is **native/MCP qualification**, not an actual-model rehearsal or acceptance of two complete rehearsals. The model API key was deferred by the user.

## Source and environment

| Item | Accepted value |
| --- | --- |
| Source commit | `315503c59eb5b515768d4c7c176983180ff15576` |
| Working tree in all r2 step manifests | Clean |
| Network / RPC | `near:testnet` / `https://test.rpc.fastnear.com` |
| Core | `core.agenttrust-73cf3674cd1978d09120a484.testnet` |
| Owner | `owner.agenttrust-73cf3674cd1978d09120a484.testnet` |
| Issuer | `issuer.agenttrust-73cf3674cd1978d09120a484.testnet` |
| Provider A / B | `service-a.agenttrust-73cf3674cd1978d09120a484.testnet` / `service-b.agenttrust-73cf3674cd1978d09120a484.testnet` |
| Production WASM SHA256 | `f55e07c756bf2b7f3e6c4011dbed49eb0e10048b4d55eccd8f6bba4d829b719f` |
| On-chain code hash | `HWp3imxWMrJgKQ7zAA2muWZYcXozELiWikUnLV6DwHxS` |
| Deployment transaction | `7canY4idgiM854pCRxY2Vw4UStzXxWezjriwoqZjouqc` |
| Restricted worker public key | `ed25519:Emha3eYP1hoGAqpiKmn75tB7etp58UZS1br8p7sh2hK` |

The deployment, subsequent FINAL account queries and payment-execution metadata bind this production code hash. All **218 artifact entries across the 23 r2 step manifests** were independently rehashed successfully. `r2-14-validation` and `r2-21-identity-quote` are preparation captures; their existence is not a claim that they submitted transactions. Every retained transaction status response was FINAL with successful receipt execution; contract refusals are decoded successful returns containing a rejection decision.

Setup installed a finite **0.5 NEAR gas allowance** on the worker key, restricted to the core account and `execute_payment` only. The session purchase cap remains **0.01 NEAR**, the owner daily cap **0.05 NEAR**, and the dispatch rate **5/minute**. The gas-allowance repair did not raise spending caps. The profile requires `invoice.audit.v1`, suite version 1, hash `xtCJ71mS8vG1KVIyj6ttKwBmQ7Su5suqkSLCUn8Xl40=`, from the configured issuer. Provider B credential issuance was FINAL in transaction `2qghHS9pG92Kcj8staroJ8pKjoA4tE5uAyddjfSE1PuA`.

## Accepted native transactions

| Capture / operation | Transaction | Observed result |
| --- | --- | --- |
| `r2-16-missing` | `FqN8uJV14CYu6CQxQcY947zPktanjk2Z4Q8QBuEMvymN` | Actual worker submission returns contract `MISSING`; payment absent before/after, zero payout delta and no service payout receipt. |
| `r2-17-purchase` | `8n9Dvkt9Wz46QpDajsQi4D5nDuaTY6vfndJjnfmpr1LV` | Exactly one successful native **0.002 NEAR** transfer to B, successful private self callback, FINAL settled payment and checked report. |
| `r2-18-retry` | `C1nbaeEMkLbRX1Mi3LWC8q6oRyvFjsTeAzvHCCX68oGt` | A new transaction submits the exact original signed quote and credential; contract returns `duplicate:true`, the original settled record is unchanged, and no additional payout is generated or observed. |
| Scripted MCP buyer | `FGvt6NRqdZXYEFiCuwAaAsYqzYVBrR2iPUdWQcQ7SHFz` | A separate buyer payment transfers **0.002 NEAR** to B, settles through its successful callback and returns the checked report. |
| `r2-19-revoke` | `9Ua5QyVCeqEH2vVZKjUPUy8W94dzLov5TsrdW91Gzsv1` | Issuer changes the original B credential to `revoked:true`; remaining credential fields match issuance. |
| `r2-20-revoked` | `GE8A2m21EsxqczmJeJuDWf8egNLrPmyDjjUGazAmz5zE` | Actual worker submission returns contract `REVOKED`; payment absent before/after, zero payout delta and no service payout receipt. |
| `r2-22-rotate` | `Ayyc5r7kc7w9aHoRJRdo1FRGgWxxNx5rMZxYNCKQWCgj` | Provider B changes its registry version from 1 to 2 and payout account to `agenttrust-73cf3674cd1978d09120a484.testnet`. |
| `r2-23-identity-refusal` | `5b3chx8L71rbPp9vVzcDVwcofd24KqQ4kjiN8ziDB3Vf` | Actual worker submission of the preserved version-1 quote returns contract `IDENTITY_CHANGED`; payment absent before/after, zero payout delta and no payout receipt to any service. |

The direct purchase payment ID is `lf82ThZczdkukCNYfPlZpHkuo7yep/VGyokMBPjgZSQ=` and invoice hash is `QEPiaHgQ0Gw5nwUqH3tM0r4MdnO6C1J1Tn2nFNLk0a4=`. Its native payout receipt is `326EimBja5pmqBp7HsuEtCXo1TLAhjGTnLSigDTx1SHB`; callback receipt is `2t1gaJE34mZ5WfMUygDsQ73qLtHmennLjpd56Kyj7CRn`. The retry preserves the full payment record, including original dispatch time `1794500966855177243` and settlement time `1794500967982343585` nanoseconds. Its only other receipt is a gas refund to the owner.

The identity quote in `r2-21` and `r2-23` is identical, including signature, payment ID, version-1 service identity and original payout account. It expires at `1794501241265000000` nanoseconds. The actual rejecting core receipt executed in block `E9N3gHbWNzGxZ9sK7WzFAkfcjNPqJaJMmrMvUJZ2poKE`, height `277388081`, timestamp `1794501129436946528`: **111.828053472 seconds before expiry**. This is an identity refusal while the quote is unexpired. The retained quote has no credential and its pre-rotation preview was `MISSING`; this case establishes identity-check precedence, not a separately valid credential surviving rotation.

## Scripted MCP flow and saved replay

The first buyer trace, `952c4f4f-ebbd-454e-b048-20d6995137b1`, runs from `16:30:09.271` to `16:30:18.223 UTC`:

1. `list_services`, then `get_policy`.
2. `pay_service` for A returns a definitive **preview `MISSING`** outcome. This buyer attempt did not execute an on-chain refusal. The separate `r2-16-missing` transaction above supplies that proof.
3. Exactly one `pay_service` call for B returns a settled payment and checked report.

The buyer's B payment ID is `RGXCx1zeavx/3ONZmf5YR9zzpls2FSJjye4eOdXxgV8=`; its invoice hash is `kjaPfdeoiQHojfKWMLsC2dSz7Jma7/Bsp/1xC5s+3e4=`. Raw FINAL evidence matches the configured worker key and exact invoice/credential. Payout receipt `Euxhw8kE4X5FWB6puYHuJsVXoaJgGsfMNkEJFT8q3R28` transfers exactly `2000000000000000000000` yoctoNEAR; self-callback receipt `FdmSYc5ZActGKK54EthJNsW2Lsqsn8zsrbxEtjLaxUqY` returns the exact saved settled record. Tool argument and payment-outcome hashes were independently checked against the retained records and synthetic fixture.

Replay run `3254f216-6aff-4627-a322-90e9dbb7016e`, at `16:30:54.570–16:30:54.588 UTC`, contains only `started` and `completed_replay`. It returns the same saved payment/report, records **zero model responses and no tool calls**, and preserves result hash `34406a717c8ac6be98e1c66eb58e9f48bb3b8810881bc88971228e9b3dcaf9b7`. This is a keyless saved-result replay. The separate `r2-18-retry` supplies native duplicate-submission proof for the direct purchase's different payment ID.

Both buyer runs are explicitly scripted. The original run is labeled `scripted_harness_not_autonomous`; replay is labeled `recorded_replay`. Neither is evidence of an actual model choosing and calling tools.

## Report usefulness and website HTTP evidence

Both purchases return the exact committed `fixtures/invoice-audit/v1/mixed-validity.json` golden report for the same synthetic CSV. The report identifies **15 rows: 8 accepted, 7 rejected**, duplicate vendor/invoice pair `acme` / `A-100` on rows 1 and 2, and row-specific errors for negative/invalid amounts, unsupported currency, missing identifiers and column count.

| Currency | Total of valid rows | Row count |
| --- | --- | --- |
| EUR | `3.23` | 2 |
| INR | `10000000000000000.00` | 2 |
| USD | `19.25` | 4 |

Totals include valid duplicate rows and are explicitly **not payable totals**. The fixed synthetic fixture exercises parsing and reporting; it does not establish arbitrary-input audit quality. Verified request hash: `b6yhwgU63NdqCBcY+nLV0iOcPGeCZDWa8pGNPQQ00B4=`. Verified compact report SHA256: `47fb746c242a16e629e9cb553702ec8e289afdd57b57265a22ac2c6fe1be565a`.

At `16:33:23.933496 UTC`, a recorded HTTP GET to `http://127.0.0.1:3000/api/decisions` returned **200**, `kind: ready`, `origin: final_contract_view`, the correct r2 core/owner, **two settled payments**, the **three executed refusals** (`MISSING`, `REVOKED`, `IDENTITY_CHANGED`) with matching transaction references, and `unresolved_references: 0`. This checks the website's data route; no browser or visual interaction was performed.

## Retained evidence and remaining gates

The dated local records are intentionally excluded from Git:

- `artifacts/local/testnet/r2-01-deploy` through `r2-23-identity-refusal`: manifests and 218 hashed artifacts, including raw FINAL transaction/receipt payloads and before/after state queries.
- `.agenttrust/testnet-demo-r2/buyer-jobs/`: immutable context, selection, outcome and trace records.
- `.agenttrust/testnet-demo-r2/evidence/scripted-buyer-console.json`, `scripted-buyer-replay.json` and `scripted-buyer-final-transaction.json`: console results, replay and raw FINAL buyer settlement.
- `.agenttrust/testnet-demo-r2/evidence/web-decisions.json` and `identity-refusal-block.json`: HTTP response and execution-block timestamp binding.

These are dated RPC/HTTP observations, not a light-client proof. Providers and issuer are project-operated, and inputs are synthetic. At the end of r2 the B credential is revoked and its registry identity is version 2; this environment is retained as qualification evidence, not counted as a fresh model rehearsal. The earlier r1 failure remains separately documented in [testnet-evidence.md](testnet-evidence.md).

**Still unestablished by this record:** an actual-model tool loop, two complete accepted rehearsals, completion of every native Sandbox case, browser/visual QA and the final recording. This document does not waive or mark any of those gates complete.
