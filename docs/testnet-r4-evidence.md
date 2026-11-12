# Testnet r4: second actual-model purchase rehearsal

**12 November 2026, 23:42–23:46 UTC.** This is a second, independently prepared operator sequence with a local model, restricted MCP worker, two controlled HTTPS providers and native NEAR testnet settlement. It uses different core, owner, issuer, provider, session, credential and payment IDs from r3. It covers the direct contract refusals, paid audit and retry, a separate model-requested paid audit, credential revocation and identity rotation. The separate native refund-order runtime case remains open.

## Source and controlled environment

| Item | Observed value |
| --- | --- |
| Captured source commit / working tree | 9338803431ecce07bb62945cd0ddecc0bf0a9d87 / clean |
| Network / RPC | near:testnet / https://test.rpc.fastnear.com |
| Core / owner | core.agenttrust-ec8b75ed926ec1b292c322fd.testnet / owner.agenttrust-ec8b75ed926ec1b292c322fd.testnet |
| Issuer | issuer.agenttrust-ec8b75ed926ec1b292c322fd.testnet |
| Controlled provider A / B | service-a.agenttrust-ec8b75ed926ec1b292c322fd.testnet / service-b.agenttrust-ec8b75ed926ec1b292c322fd.testnet |
| Production WASM SHA-256 | f55e07c756bf2b7f3e6c4011dbed49eb0e10048b4d55eccd8f6bba4d829b719f |
| Final on-chain core code hash | HWp3imxWMrJgKQ7zAA2muWZYcXozELiWikUnLV6DwHxS |
| Deployment transaction | 6gx1aDoD77pzsaPuZ4AB1tUAFWmXPS9Nct35gfim3yrb |
| Restricted worker public key | ed25519:2BXjgMDyRDBWtvwnY8sZJoyDKuKMciaJUcBBSRBpb2X9 |

All 23 dated r4 manifests share that source commit and report a clean working tree. Their 218 referenced artifacts passed the repository's read-only hash and structure checker: 21 captures are marked passed; the separate validation and saved identity quote are correctly marked prepared. The faucet's first response was uncertain, so the operator observed the original claim without resending it. That observation found a 10 NEAR parent balance but does not prove the helper's original grant response. Five child-account creations reached FINAL success.

The worker key is restricted to `execute_payment` on this core with a finite 0.5 NEAR gas allowance. The owner session purchase cap was 0.01 NEAR; policy had a 0.05 NEAR daily cap, five dispatches per minute and two exact trusted service identities. Provider B passed four controlled invoice-audit conformance fixtures and a signed identity check. The project-operated issuer issued B's version-1 credential in FINAL transaction 2zyH4nr6hAkr5Dq6QCXQxwMnMWNsBcUHdawWvrAVmdW3. Provider A intentionally had no credential.

## Direct native calls

| Capture | FINAL transaction | Contract result and provider payout |
| --- | --- | --- |
| r4-16-missing | 9HXLnfY5nmcLy9nWsc61HpdkskCTaw3qn5vyTBm1GQWD | Executed `MISSING` credential rejection; payment absent before and after; zero provider payout. |
| r4-17-purchase | 7wd9yNeKMKQ4A66vx5ejzitBpticoUsJSchJQ7ANb1LV | Settled 0.002 NEAR to B, final payment view and independently checked audit report. |
| r4-18-retry | 4E6XwrwGAN7YepiQZ7HV3VjRQn7Ux7B5WUKcBWfFVYet | Exact original ID, quote and credential returned `duplicate:true`; settled payment view unchanged and zero additional provider payout. |
| r4-20-revoked | 4k57RTyRuGKaKtgqZwWAjVfzKKRUcQxTr8zvnNntjB24 | Executed `REVOKED` credential rejection; payment absent before and after; zero provider payout. |
| r4-23-identity-refusal | Bbtvi6KFJasqupZmpJW8thaiH6VAsfdjE46vu6fH29hE | Executed `IDENTITY_CHANGED` rejection of the preserved old quote; payment absent before and after; zero provider payout. |

The direct purchase's payment ID was `vhPJvvHknVMmUgubm5XQdwvcTHyaVgF5zoNZSJBCniU=` and invoice hash was `OmU2KmifOvmbNYpvoiGnI/bBkG/S60eCO43iENtG4IU=`. Receipt `6XhCpJF5SmpmYXqgYUXtpfEzMLJyUdTCnPcAiZoxc1tT` transferred exactly 2000000000000000000000 yoctoNEAR from the core to B; receipt `5tjN5UASmnApFV69uawFUTKEtYUPY1pax7Uw1qWiPi1d` called the private self-callback. The retry used identical saved-attempt bytes (SHA-256 `43fb5ffa646f97064b98fae0a2dc8598255563e308569905a7d6e16fc657e145`), returned `duplicate:true`, preserved the byte-identical settled payment view and had no second core-to-B transfer.

The issuer revoked B's credential in FINAL transaction `2oCNNdVGd8Z5UPvS1jm4r1C3Acscv9aWrjSGr2medR9s`. B rotated its registry identity to version 2 and a new payout account in FINAL transaction `h576Uf7HV8MrwwP3QuEYdZfwVwtET16AUFaedyd6Y1x`. The saved and attempted old quote bytes were identical (SHA-256 `89349092cb9d75bfd3ea889cede36c5811a559ade32ccdb5a6def92241add697`). Its rejecting core receipt executed at block height 277432577, 109.753 seconds before quote expiry. The quote carried no credential, so this demonstrates identity-check precedence rather than a valid credential surviving rotation.

These rejections are successful FINAL NEAR transactions whose contract results contain refusal decisions. Zero payout concerns service transfers, not network gas.

## Actual local-model and MCP purchase

The model run `02b59dad-9e6a-47c9-a524-681869bab00b` ran from 23:45:31.471 to 23:45:46.815 UTC with an installed local Ollama `qwen3:4b-instruct` model. Its trace records five actual model responses and the requests `get_policy`, `list_services`, `get_service`, `pay_service` for A and `pay_service` for B, in that order. The local model saw five task-usable tools; its `pay_service` schema offered only the currently host-allowed supplier. The host supplied the precommitted payment ID and exact original CSV from the job context, marked both fields as host-bound in the trace, and independently checked every tool result.

The A model attempt returned a validated **preview `MISSING`** credential refusal without submitting a chain transaction. It is distinct from the executed r4-16 rejection above. Only then did the model request B. B's separate payment ID was `ZIu51ge1LUZIwCdlrfb/OgFivcWwI9NXeUUN5DJJaHo=`, invoice hash `OnpxFiZuSqWp7FTUakHuiSSC3TFJfQRYHodVwak9vRg=` and FINAL transaction `EAmDNch3Qi9LLeD2cSxp93oC5NAFD6N8SWzFT3eNGfSF`. Receipt `HS3fQWFtctwcgdByLTRPvW3uASJScrVzGu2WJ7QSaX5j` transferred exactly 0.002 NEAR from the core to B; receipt `4maUWPCBaS8wLbnuWb9SmGS3uBhJnidYCacHjoVXgfX1` invoked the private self-callback. The saved outcome records final block height 277432499, settled state and a checked report bound to request hash `b6yhwgU63NdqCBcY+nLV0iOcPGeCZDWa8pGNPQQ00B4=`.

The report matches the committed mixed-validity golden: 15 rows, 8 accepted, 7 rejected and one duplicate vendor/invoice group. Valid-row totals are EUR 3.23, INR 10000000000000000.00 and USD 19.25; these include valid duplicate rows and are not payable totals. Its compact JSON SHA-256 is `47fb746c242a16e629e9cb553702ec8e289afdd57b57265a22ac2c6fe1be565a`. This is a controlled synthetic-input result, not evidence of general audit accuracy.

Keyless terminal replay `0bdec7c7-2fc4-48c9-a608-87fbc77faaff` returned the same saved paid report and payment at 23:45:51.754–23:45:51.814 UTC. Its trace contains `started` and `completed_replay` only: zero model responses, zero MCP tool requests and no new payment. The replay's result hash is `1696bd3d8342cf0acc529de2e7a1919d42b61d15446d92b9c884dbf149261af6`.

## Independent final read and retained originals

At 23:48:59.742 UTC, a fresh final RPC `get_payment` read at height 277432818 (block `3TqwooA53qoGUTVyXEKh3888dLg8brwdtimezFARs2sh`) still returned the model payment as settled with the same ID, service and 0.002 NEAR amount. A fresh FINAL transaction-status read found the exact core-to-B transfer above; the core account still matched the deployed code hash. These are public RPC observations, not a light-client proof.

The captured B balance increased by exactly 0.002 NEAR between r4-18's post-retry read and r4-20's pre-revocation-refusal read, after the model purchase and before B signed its identity-rotation transaction. B's later rotation spent gas, so its current balance is not an exact payout delta from the earlier baseline.

To inspect the model transaction independently, use the read-only testnet RPC call:

    curl --fail --silent --show-error https://test.rpc.fastnear.com \
      -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":"r4-model","method":"EXPERIMENTAL_tx_status","params":{"tx_hash":"EAmDNch3Qi9LLeD2cSxp93oC5NAFD6N8SWzFT3eNGfSF","sender_account_id":"owner.agenttrust-ec8b75ed926ec1b292c322fd.testnet","wait_until":"FINAL"}}'

The original captures and job records remain ignored locally. These SHA-256 values bind this summary to retained originals; the files themselves are not copied into this document.

| Retained original | SHA-256 |
| --- | --- |
| r4-16-missing manifest | d192ee7ae77b4da608cfe495d2b534f701efd44f83346e8cf3f52a9aa1aab5e5 |
| r4-17-purchase manifest | 9bb9e1cd7e41dd085b656bb3adb5ceb90335d59444735843d95efd228b1b59ed |
| r4-18-retry manifest | 5134117ebc07a316825310c8e87e8026005692c062f68ba401ad6b7dab4d1e84 |
| r4-20-revoked manifest | b9f47d9dbc42e4ec32df8ebad50cb9d0d3937333fe32e6ea133369422c6a5de9 |
| r4-23-identity-refusal manifest | 8127d1a5dfb4a75691c038267ef50010ee24c2fe877f78e1a77ec8963a426136 |
| Private buyer outcome-0 / outcome-1 records | 7b5fbe744ea9c01d1ef3d22e072033f34e8e663158145f2b77da9ca2c57c1a11 / b55489138df1f364c41f744acb810083e6d7c862c575f4d9d41df3db78784b37 |

The issuer and both providers are project-operated, the model runs locally without NEAR AI Cloud or TEE attestation, and the paid providers/MCP are localhost services rather than public hosted endpoints. The website and docs are public read-only surfaces; this file does not verify an updated r4 website feed. Browser visual QA was not performed. The separate native refund-order Sandbox case and any recording/submission require their own evidence. Nothing here claims that an unknown or pending payment is safe to resend under a new ID.
