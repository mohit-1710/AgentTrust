# Testnet evidence: first environment

**12 November 2026, captured 16:14–16:19 UTC, diagnosed at 16:22 UTC.** Production deployment, twelve setup transactions and provider B credential issuance have accepted FINAL testnet evidence. Endpoint validation also passed its bounded fixture checks. **No completed native service payment, actual model run, full rehearsal or Sandbox gate is established by this record.** The first worker submission exposed insufficient gas allowance; its original uncertain capture is preserved.

## Network and source

- Network: `near:testnet`; captured RPC: `https://test.rpc.fastnear.com`.
- Core: `core.agenttrust-21b5bd861c084ee60b5c2f9b.testnet`.
- Production WASM SHA-256: `f55e07c756bf2b7f3e6c4011dbed49eb0e10048b4d55eccd8f6bba4d829b719f`.
- Observed deployed code hash: `HWp3imxWMrJgKQ7zAA2muWZYcXozELiWikUnLV6DwHxS`, the same digest encoded in base58.
- Deployment source: [f56c6f5](https://github.com/mohit-1710/AgentTrust/commit/f56c6f5aff3d5ae42552ef6f035e04e152d96784). Setup, validation and issuance: [f448259](https://github.com/mohit-1710/AgentTrust/commit/f448259478fa0356c3e597210c350062894b54e4), recorded clean.

The deployment manifest retains `working_tree_dirty:true`. Its pre-run executable provenance recorded the same source commit as clean, the production hash and emitted-file hashes. The operator investigation attributed the difference to historical untracked `.playwright-mcp/` artifacts becoming visible when the isolated child lacked the parent's global Git ignore configuration. The project ignore was then made explicit before setup. The original manifest is preserved; this annotation does not rewrite it as a clean capture or prove executable identity by itself.

## Accepted observations

Deployment used the core account's own key, with exactly `DeployContract` and `new`. The FINAL outcome and receipts succeeded; subsequent final account/configuration reads matched the production hash, testnet/core identity and `0.05 NEAR` operating reserve.

The setup captures show:

- Owner deposit of `1 NEAR`, split into `0.75 NEAR` available principal and `0.25 NEAR` initial storage credit; the immediate final view records the storage charge separately. Issuer and each provider deposited `0.1 NEAR` for their own storage.
- Both provider identities registered at version 1, with their own payout accounts and separate invoice keys. Owner trust binds those exact identities to the `invoice-audit` profile.
- A session bound to that profile/revision with a `0.01 NEAR` purchase cap. The installed protocol key's final permission names only this core and `execute_payment`, with `0.05 NEAR` gas allowance. This observes installation; adversarial protocol-key enforcement still needs its separate tests.
- Owner policy revision 5 enabled, with a `0.05 NEAR` daily cap and five dispatches per fixed minute.

Provider B's localhost HTTPS validation captured a fresh signed identity descriptor and all four committed conformance fixtures. Independent read-only review verified its Ed25519 signature, service/payout/endpoint binding, validity interval, suite/response hashes and exact golden reports. Issuance ran a second fresh validation with a different nonce; it did not reuse the first validation's evidence. Its evidence hash is `LFbE9Oh4/spsXJcKAoO6tPy4rLzVz6pn8tRBF9aVm+E=`, with suite hash `xtCJ71mS8vG1KVIyj6ttKwBmQ7Su5suqkSLCUn8Xl40=`. The issuer's exact assertion succeeded on chain, and the final credential view matched revision 1, unrevoked. This is controlled fixture conformance, not general quality or runtime attestation.

## Accepted transaction index

These are fourteen distinct transactions: deployment, twelve setup operations and issuance. Each captured result was FINAL and successful; artifact hashes, original transaction locators, signing-key fingerprints and relevant resulting views were checked.

| Capture | Operation | Testnet transaction ID |
| --- | --- | --- |
| `r1-01-deploy` | Deploy production core and initialize | `DLKVS9SCjdG8Zes6qtQg3bCw8DatsYKgpN9EtiyZ8kAT` |
| `r1-02-owner-deposit` | Owner deposit | `64crJArNdkdJap44hsTRW3v2vJFxr9exW4vf12Bm6VJ6` |
| `r1-03-issuer-deposit` | Issuer storage deposit | `4xAKcVX2T5X4X3N9CwX3Ve2CW2eLZ4ugFmLZG9xEFc2M` |
| `r1-04-a-deposit` | Provider A storage deposit | `27h4c7ma9eh7d49nLTWqbysjMRE779VW1tRshptnYVBM` |
| `r1-05-a-register` | Register provider A | `2wiBnMYFfn2jLw5JM3t1K7ExFzYVRByU5EV7ArzpEFN1` |
| `r1-06-b-deposit` | Provider B storage deposit | `Fnnwoow8eNNCJK424VKpk2c6hZnXRWK6mrX93Z82G89L` |
| `r1-07-b-register` | Register provider B | `H3QPYXG2Z67fuYcK1fuS7WeeJcW8YFFeso5wykh99vFQ` |
| `r1-08-profile` | Set required capability profile | `F4RKeESRQTFEwYuMkeZayZAqBgpgwp8P2By1qna49DQv` |
| `r1-09-trust-a` | Trust provider A identity | `6pTW4bjzksRvAg3AnmMQmtDPo1hNGr7KVPsz9vaSfo6c` |
| `r1-10-trust-b` | Trust provider B identity | `EqaKbNmwzNyXBifFrUsEHgQnyRNys3Vyhnehh2uwPZx5` |
| `r1-11-session` | Register worker session | `47eCma4jbLEYhXVMCaCY8YAAE8S7E9Ra1hL5JNaK7Fbw` |
| `r1-12-worker-key` | Install restricted worker key | `2W47np3dd7fJEXRGM817Hn1WDPsMK3QQrBxx866gLKoi` |
| `r1-13-policy` | Enable owner policy | `9zrBDXGLurWhibL5xyofzdV1Cg9M4Lb8CSCDmXf5xdSU` |
| `r1-15-credential` | Issue provider B credential | `Bedy72B2RJgHugRCvkWf3g6nTtZqXinxTD8Fr1ULMFfT` |

`r1-14-validation` is an HTTP/conformance preparation capture with six referenced artifacts and **no issuance transaction**. Deployment and issuance each contain nine referenced artifacts; the twelve setup captures each contain eight. Originals remain under ignored `artifacts/local/testnet/`; this checked-in summary is not a publication of the full raw evidence package. Preserve those originals and publish only separately reviewed artifacts.

## Worker gas failure and remaining gates

`r1-16-missing`, captured at `2026-11-12T16:19:00.441Z`, reports `uncertain` for original transaction `Bd2FAFGzC17GEMQQcUqX1ZE5DaQkjHi7Tr7b69vkSDVY`, signed by `owner.agenttrust-21b5bd861c084ee60b5c2f9b.testnet`. Its original ID, signed invoice and transaction checkpoint remain unchanged. A hash-only status query returned `UNKNOWN_TRANSACTION`, which alone does not establish nonpayment.

The unsigned transaction was subsequently reconstructed from the preserved arguments, original nonce `277386572000001` and block `277386733`; its hash exactly matched that checkpoint. A **read-only** `tx` request using the matching signed bytes and `wait_until: NONE` returned typed `INVALID_TRANSACTION / InvalidAccessKeyError / NotEnoughAllowance`: allowance `50000000000000000000000`, required cost `150925442492864500000000` yoctoNEAR. No rebroadcast was performed. Live protocol configuration reported version 88 and `min_gas_purchase_price: 1000000000`; the separate current burned-gas price was `100000000`. Thus a 150 Tgas call requires over 0.15 NEAR of prepaid allowance even though unused gas is refunded. This diagnoses protocol admission failure, **not** an executed contract `MISSING` refusal.

Private, immutable diagnostic records are `evidence/original-missing-unsigned.json`, `evidence/original-worker-readonly-diagnostic.json` `evidence/worker-gas-protocol.json` and `evidence/worker-gas-post-diagnostic-reads.json` inside the original bundle. Nearcore's status path checks a supplied transaction with `check_only: true`; it does not broadcast it ([source](https://github.com/near/nearcore/blob/2.14.0/chain/jsonrpc/src/lib.rs#L1151)). The repair increases only the finite gas allowance in fresh environments. Purchase/day caps remain unchanged; the original environment is retained as the failed configuration run, not reset or counted as a successful rehearsal.

Still required: inspect the paid report and exact duplicate/refusal cases in corrected environments, capture actual model execution, review two complete rehearsals, and inspect native runtime cases. The separate Sandbox candidate still has uncompleted refund-gap and delayed-midnight cases. Browser/visual checks remain unperformed under the user's instruction. These trusted local/RPC captures are dated evidence, not light-client proofs, a full runtime pass or video-ready certification. See the [evidence map](evidence-map.md), [operator route](testnet-operator.md) and [recording evidence index](demo-script.md#recording-evidence-index).
