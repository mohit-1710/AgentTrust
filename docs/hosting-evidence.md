# Public website and docs: deployment evidence

## Current r4 promotion: 13 November 2026

**Observed 00:03 UTC.** Source commit `5b58b70f7a6a8c7be494cbe42bdbe2f7b0918e23` was pushed to the private personal repository and archived from a clean working tree. The archive contained 583 tracked files; both Vercel dry runs selected 579 upload files (9,263,337 bytes). The upload contained no ignored `.agenttrust`, `.sprint`, private capture, or live `.env` file. The tracked `web/.env.example` is a sample. Both production-target deployments used `--skip-domain`, reached `READY`, and passed immutable-URL checks before promotion.

| Surface | New deployment and immutable URL | Public domain checks |
| --- | --- | --- |
| Website | `dpl_B3QxcwwLTeVFRsRAXYS8Uz62Pyna` · [staged build](https://agenttrust-e1m6ouons-mohit-kumars-projects.vercel.app) | [www.agenttrust.tech](https://www.agenttrust.tech): `/`, `/decisions`, `/blog` and two articles returned HTTP 200 with NEAR copy. The apex redirects to `www`. |
| Docs | `dpl_6aR2EQBgpj3MJTeGuj26rXezuwce` · [staged build](https://agenttrust-docs-site-6msmsns43-mohit-kumars-projects.vercel.app) | [docs.agenttrust.tech](https://docs.agenttrust.tech): home, quickstart, changelog, [r2](https://docs.agenttrust.tech/verification/testnet-r2), [r3](https://docs.agenttrust.tech/verification/testnet-r3), [r4](https://docs.agenttrust.tech/verification/testnet-r4) proof pages, `llms.txt` and search returned HTTP 200. |

The [public decision endpoint](https://www.agenttrust.tech/api/decisions) returned `kind: ready` for `core.agenttrust-ec8b75ed926ec1b292c322fd.testnet` and its matching r4 owner. Its two settled items have the exact direct and model payment IDs `vhPJvvHknVMmUgubm5XQdwvcTHyaVgF5zoNZSJBCniU=` and `ZIu51ge1LUZIwCdlrfb/OgFivcWwI9NXeUUN5DJJaHo=`. Three executed rejection rows referenced the r4 `MISSING`, `REVOKED` and `IDENTITY_CHANGED` transactions; `unresolved_references` was zero. A fresh final read-only core-account query at height `277434286` returned code hash `HWp3imxWMrJgKQ7zAA2muWZYcXozELiWikUnLV6DwHxS`, matching the [r4 proof](testnet-r4-evidence.md). The feed reads prior on-chain results; promotion did not submit a new payment or run the model.

Docs Ask AI `GET /api/ask` reported `available: false` and `POST /api/ask` returned HTTP 503 on both the immutable build and custom domain. This deployment set `ASK_AI_ENABLED=false` and empty per-deployment provider-key overrides. The HTTP result establishes that the route is disabled; it does not prove project-level key entries were removed. Paid HTTPS providers, MCP and the actual model buyer remain local. Browser visual interaction/console checks and the separate native refund-order runtime case remain open.

## Prior r2 promotion: 12 November 2026

**Observed 23:04–23:12 UTC.** The then-current production-target deployments were built from tracked files at commit `ff1d812` in clean temporary archives and promoted after immutable-URL checks. No ignored `.agenttrust`, `.sprint`, local artifact or live environment file was included. Both existing Vercel projects had been disconnected from the old upstream Git repository, so an upstream push cannot replace this NEAR build.

| Surface | Vercel deployment | Public domain | Checked result |
| --- | --- | --- | --- |
| Website | `dpl_E8FWbwKSHUcEfopCLTGnpAMbGNAL` | [www.agenttrust.tech](https://www.agenttrust.tech) | `/`, `/decisions`, `/blog/agent-payments-with-an-owner-boundary` and `/api/decisions` returned HTTP 200 with corrected NEAR copy and no Solana or stale public-hosting claim in inspected HTML. |
| Docs | `dpl_8reSzpTjMscMmCPbDTSgYiLZ83ik` | [docs.agenttrust.tech](https://docs.agenttrust.tech) | `/`, `/reference/changelog` and `/api/search?query=payment` returned HTTP 200 with corrected NEAR content. `POST /api/ask` returned the explicit HTTP 503 unavailable state. |

The [website decision endpoint](https://www.agenttrust.tech/api/decisions) returned `kind: ready`, two retained payment items, three independently verified executed refusals (`MISSING`, `REVOKED`, `IDENTITY_CHANGED`) and `unresolved_references: 0`. Its configured core is `core.agenttrust-73cf3674cd1978d09120a484.testnet`, the dated [r2 native run](testnet-r2-evidence.md). A fresh read-only `view_account` at final block height `277428507` returned code hash `HWp3imxWMrJgKQ7zAA2muWZYcXozELiWikUnLV6DwHxS`, matching r2's recorded production code hash. This is a public RPC view of prior testnet activity, not a fresh purchase or a live model run. The browser display and interaction have not been accepted by visual QA.

The website project's production environment contains only public NEAR identifiers/rejection transaction references and the two public surface origins; no signer variable is present. The paid HTTPS providers, MCP server and model buyer still run locally for the controlled demonstration. Ask AI is intentionally unavailable; the docs search and static corpus remain available. No mainnet contract, public worker signer or production custody is claimed.

To recheck the HTTP boundary without credentials:

```sh
curl --fail https://www.agenttrust.tech/api/decisions
curl --fail 'https://docs.agenttrust.tech/api/search?query=payment'
curl -i -X POST https://docs.agenttrust.tech/api/ask \
  -H 'Content-Type: application/json' -d '{"messages":[]}'
```

The decision feed must retain its dated source distinction when references change. A successful HTTP response does not prove visual behavior, provider availability, model execution, or a new native payment.
