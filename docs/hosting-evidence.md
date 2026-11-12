# Public website and docs: deployment evidence

**Observed 12 November 2026, 23:04–23:12 UTC.** The current production-target deployments were built from the tracked files at commit `ff1d812` in clean temporary archives and promoted after immutable-URL checks. No ignored `.agenttrust`, `.sprint`, local artifact or environment file was included. Both existing Vercel projects were disconnected from the old upstream Git repository before these deployments, so an upstream push cannot replace this NEAR build.

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

The decision feed must retain the dated r2/source distinction if its references change. A successful HTTP response does not prove visual behavior, provider availability, model execution, or a new native payment.
