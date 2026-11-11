# Reuse baseline and actual head start

Inspected 11 November 2026. Planning/static inspection only: no dependency installation, application build, test suite, validator, transaction, deployment or package publication was run. This inventory describes reusable source, not completed NEAR functionality.

## Source boundary

- Upstream: [agenttrust-labs/agenttrust](https://github.com/agenttrust-labs/agenttrust).
- Exact source: [`21a3b111b7677d0b06ab1b063d647e4f52ea3b17`](https://github.com/agenttrust-labs/agenttrust/tree/21a3b111b7677d0b06ab1b063d647e4f52ea3b17).
- Reference checkout: `.reference/agenttrust`; clean when inspected. This reference is not the implementation workspace or a deployed NEAR baseline.
- Root `LICENSE`, `trustgate/sdk/LICENSE` and `mcp/LICENSE` contain MIT, copyright 2026 AgentTrust contributors. Preserve that notice with copied substantial source and identify the baseline/new-work boundary in the new repository. Do not copy upstream badges as new verification results.
- The user's existing Monad project is a separate repository-management concern. It is not the code baseline described here.

Canonical first-build scope is [plan.md](plan.md); [the feature specification](../../research/agenttrust-near/09-feature-spec.md) supplies research rationale. Build one native NEAR asset, preserve visual design, implement the native policy/vault core, service identity/capability credentials, explicit trust/block lists and useful paid-service workflow. No percentage of the build is claimed complete from this inventory.

## What can carry over substantially unchanged

“Unchanged” below means the chain-independent presentation implementation can be retained. It still needs build and visual verification after import; surrounding copy, URLs or data props may change.

| Source paths | Reusable responsibility | Boundary |
|---|---|---|
| `web/app/globals.css`, `web/components/*.module.css`, marketing layout | Typography, spacing, colors, responsive layout and section treatment | Preserve existing design; do not introduce a redesign task. |
| `web/components/` presentational sections and cards | Existing visual hierarchy and interactions | 78 TSX component files exist; this is an inventory count, not a guarantee every component is chain-neutral. Content-bearing components remain in the adaptation set below. |
| `web/lib/animations/*.ts`, `web/app/scroll-runtime.tsx` | GSAP/scroll choreography | 14 animation modules. Keep behavior unless changed content exposes a concrete layout defect. |
| `web/public/fonts/`, hero media, generic illustrations and logo marks | Existing visual assets | Inspect rendered media for chain/proof wording before publishing. Blog covers named for Solana or Kani are not generic NEAR artwork. |
| `docs-site/app/(docs)/layout.tsx`, `docs-site/lib/source.ts`, `docs-site/source.config.ts`, layout/shared helpers | Fumadocs navigation, page structure, search plumbing and MDX rendering | Content and metadata still require migration. |
| `docs-site/components/ask-ai/` visual components | Existing documentation assistant panel, messages and suggestions layout | Provider configuration, prompts and documentation context are not preserved blindly. |
| `web/components/blog/` rendering primitives | Code blocks, notes, quotes, copy controls | Existing posts and generated social cards must be clearly historical or rewritten. |

The practical head start is a finished visual system and component library, a documentation shell, and existing adapter/MCP organization. We do not need to invent these surfaces during the sprint.

## What is reusable with adaptation

| Source paths | Keep | Change for the frozen NEAR scope |
|---|---|---|
| `web/data/hero.ts`, `heroSdk.ts`, `programs.ts`, `performance.ts`, `storytelling.ts`, `trilemma.ts`, `network.ts`, `plugAndPlay.ts`, `stats.ts`, navigation/footer/link modules | Separation of copy/data from layout | Replace chain IDs, deployment state, atomicity, tiers, install commands, live-adapter claims and old proof counts. Preserve module shape where useful. |
| `web/app/(marketing)/decisions/page.tsx` and CSS | Decision table and visual presentation | Replace Solana JSON-RPC/log decoding with the NEAR receipt/decision reader; exact NEAR denomination; distinguish authorization from pending/settled/failure states. |
| `live-app/app/page.tsx` | Same decisions presentation | It duplicates the marketing decisions reader. Choose one canonical implementation/route; do not maintain two separate native chain parsers. A redirect can preserve the existing URL. |
| `docs-site/content/docs/**/*.mdx` | Route taxonomy, explanatory structure and page scaffolding | All 44 MDX pages are in the assistant/search corpus. Rewrite active instructions, examples and claims; remove unsupported features from current navigation or label historical material. |
| `docs-site/components/docs/ProgramIdsTable.tsx`, `KaniProofBadge.tsx`, `docs-site/lib/constants.ts` | Table/badge presentation if still needed | Actual contract/account metadata and measured verification results. No three-program deployment or inherited 7/7/662 proof claim. |
| `docs-site/lib/server/docs-context.ts`, `data/ask-ai-suggestions.ts` | Context loading and constrained docs-answering pattern | New source repository link, native terms, truthful prompts and fully migrated corpus. Hiding stale pages from the sidebar is insufficient: the loader reads every MDX recursively. |
| `docs-site/scripts/build-namespaces-table.mjs`, `build-changelog.mjs` | Build-time generation concept | Namespace generator currently reads Solana `examples/attestor-demo/devnet-namespaces.json`; changelog generator reads old SDK/MCP release history and links upstream. Replace the inputs/templates before relying on a docs build. |
| `trustgate/sdk/src/types.ts`, `facilitator-factory.ts`, `express.ts` | Typed results, adapter boundary, HTTP middleware ergonomics | New payment types/IDs, read-only preview, authoritative contract execution, signer boundary and independent settled-receipt verification. Treat as design patterns, not drop-in NEAR code. |
| `trustgate/server/src/facilitators/types.ts`, `registry.ts`, schema parsing organization | Normalize transport input into a shared request | One custom native-NEAR HTTP 402 adapter. No Pay.sh/Dexter/MCPay/atxp “live on NEAR” status without a working integration. |
| `mcp/src/server.ts`, tool/resource/error organization, protocol test scaffolding | MCP registration, typed descriptions, error responses and resource packaging | Rewrite chain client, config and embedded assets. Expose only the frozen tools; agent `pay_service` uses a local restricted key, owner management is separate, hosted MCP stays read-only. |
| `status-page/app/`, `status-page/lib/surfaces.ts` | Existing status layout and GET probe pattern | New owned deployment URLs and accurate labels. HTTP availability does not demonstrate payment enforcement or settlement. Keep off the critical path if the main demo already exposes status. |

The source has 21 registered MCP tools: 10 reads, 8 writes and 3 discovery tools. This provides structure, not 21 completed native tools. The source set has no complete NEAR `pay_service` tool; old write tools include authority/namespace setup and Solana feedback. The canonical first surface is the six tools in the feature specification, with any additional discovery tool justified by the demo.

## What must be new or rebuilt

| Source being replaced | New responsibility |
|---|---|
| `programs/policy-vault`, `programs/validation-registry`, `programs/trustgate` | Native Rust core for owner/session authority, mandatory policy admission, service registration, issuer-authenticated credentials, reservations, native payouts and private callbacks. |
| Solana IDLs, PDAs, CPI and `programs/policy-vault/src/ext/atom_engine.rs` | NEAR account/method interfaces and local subject-bound data. No ATOM binary-layout reader or fabricated numeric replacement score. |
| `trustgate/sdk/src/chain.ts`, `client.ts`, `atomicity.ts`, `spl.ts`, `quantu.ts`, registration/feedback implementations | Native view/call client, canonical invoice bytes, signing/verification, idempotent payment execution, final receipt resolution and amount formatting. |
| `trustgate/server/src/chain.ts`, `production.ts`, hosted `/settle` and proof validator | Native contract-backed spending and exact invoice/receipt binding. An off-chain preview followed by an unrestricted transfer is not equivalent enforcement. |
| Source in-memory replay map and compact feedback log | Persistent contract payment IDs and immutable request hashes, pending/settled/failed/reconciliation states, reservations and factual payment history. |
| Quantu tiers, tier velocity multiplier, permissive empty attestor set | Explicit owner service permission/blocking and required accepted-issuer evidence under the session's single fixed profile. |
| Old demo services and Solana scripts | Invoice-CSV audit provider, endpoint identity challenge, conformance suite/validator and agent selection/payment/output loop. |

New core guarantees have no inherited runtime evidence. In particular, NEAR's independent receipts, successful-transfer/failed-callback case, restricted-key authority and native storage/liquidity accounting must be verified anew.

## Dependency and script inventory

These are **declared versions and scripts in the pinned source**, not installed versions or a claim that the packages run together today. Preserve a source lockfile record and deliberately generate the new workspace lockfile when native dependencies are added. Do not make a framework migration part of the sprint.

| Surface | Declared baseline | Existing commands and caveats |
|---|---|---|
| Root | `pnpm@10.33.0`; root package `0.0.1` | `pnpm test` invokes `anchor test`. It is the wrong native verification entry point and starts a persisted Solana validator. Replace root scripts before use. |
| `web` | Next `16.2.4`, React/React DOM `19.2.4`; GSAP `^3.15.0`, `@gsap/react ^2.1.2`, Lenis `^1.3.23`, Motion `^12.38.0` | `pnpm --filter ./web build`; `pnpm --filter ./web lint`. No existing web test script. |
| `docs-site` | Next `16.2.4`; React/DOM `^19.2.5`; Fumadocs core/UI `16.8.7`, MDX `14.3.2`; TypeScript `^6.0.3` | `build`, `lint`, `types:check`. `postinstall` runs `fumadocs-mdx`; `predev` and `prebuild` run two source-writing generators. Audit/migrate their inputs first. |
| `live-app` | Next `16.2.4`, React/DOM `19.2.4` | `build`, `dev`, `start`; no lint/test script declared. Prefer the canonical decisions route over duplicate maintenance. |
| `status-page` | Next `^15.1.6`, React/DOM `^19.0.0` | `build`; `lint` is `tsc --noEmit`; dev/start use port 3500. Do not automatically unify its framework version. |
| Old SDK | `@agenttrust-sdk/trustgate 0.4.1`; Node `>=20`; Anchor JS `^0.31.1`, Solana web3 `^1.98.0` | `build=tsc`, `lint=tsc --noEmit`, `test=ts-mocha`; integration enables devnet operations. Existing `prepublishOnly` also runs tests. Do not publish these names/version claims as the native package. |
| Old server | `@agenttrust/trustgate-server 0.1.0`; Express `^4.21.2`, Zod `^3.25.76`, TweetNaCl `^1.0.3` | `build=tsc` plus IDL copying, `lint=tsc --noEmit`, `test=ts-mocha`. IDL output and chain wiring are obsolete for the native path. |
| Old MCP | `@agenttrust-sdk/mcp 0.4.5`; Node `>=20`; MCP SDK `^1.29.0`; Zod `^3.25.76` | `build=tsc` plus embedded-asset copying, `lint`, `test`, `test:conformance`; integration uses devnet. Embedded docs/program resources need replacement. |
| Rust source | Anchor CLI configuration `1.0.1`; Rust workspace members `programs/*` | Root `Cargo.lock` and Anchor tests describe the old implementation. Create a deliberate native workspace; do not claim the old toolchain as a NEAR compatibility result. |

New NEAR dependency pins, runtime test commands and CI commands belong to the implementation plan and must be verified during the toolchain task. This inventory supplies no installation or compatibility result.

## Tests worth translating, not copying as evidence

| Existing evidence/test source | Reusable test intent | Required native change |
|---|---|---|
| `programs/policy-vault/src/policies/` and `src/proofs/` | Pure evaluator separate from state mutation; pause, cap arithmetic and expiry properties | New U128/native-asset inputs, unconditional pause, owner-wide counters, fixed dispatch count, profile/issuer/identity checks. Tier and multisig properties are not v1 requirements. |
| `tests/adversarial.spec.ts`, `policy-vault.spec.ts`, `validation-registry.spec.ts` | Boundary and invalid-input scenario inventory | New authority, callback, concurrent reservation, revocation and identity-version tests against NEAR behavior. |
| `tests/atomic-tx-invariant.spec.ts`, `trustgate/sdk/test/atomicity.test.ts` | Identify the original all-or-nothing claim | Do not port the same expected rollback. Test successful transfer plus callback failure without second payout/refund. |
| `trustgate/server/test/pay-sh.test.ts`, `cross-adapter.test.ts`, SDK x402 tests | Parser, challenge-binding and transport failure cases | Test the custom native route and exact canonical bytes; no generic x402-exact conformance claim. |
| MCP schema/error/resource/protocol tests | Tool outputs follow schema, errors are legible, read-only host exposes no signer | Replace old tools/config/fixtures; add the actual native payment tool and authority separation. |
| Old `docs/proofs/` and devnet trace JSON | Provenance/history for the upstream baseline | Keep out of current NEAR verification badges. Record new commands/outcomes/receipts separately. |

No tests from this table were executed during this audit. Sandbox and validator tests persist database state and remain subject to the standing write restriction. A test file's presence is not a passed result.

## Import and publication hygiene

Prefer importing the chosen presentation subtrees and source references deliberately. Do not copy the whole workspace into an active default branch and immediately run its commands. The source contains 16 workflow files, including `daily-devnet-smoke.yml`, `devnet-integration.yml` and `anchor-test.yml`; some invoke transaction-writing scripts or persisted validators. Exclude or disable inherited automation before the first remote push. Reintroduce only the new plan's audited checks.

Existing Docker/Fly deployment configurations target the original hosted surfaces. Existing public URLs and npm package names refer to the upstream edition. Replace these before use; no deployment or package publication is part of this planning round.

Before saying the UI migration is complete, inspect active content at:

- `web/app/layout.tsx`, `web/data/hero.ts`, `programs.ts`, `performance.ts`, `trilemma.ts`, `navigation.ts`, `footer.ts`, `links.ts` and legal text.
- Both decisions pages: Solana RPC URL, log decoder, explorer URLs and six-decimal USDC assumptions.
- `docs-site/lib/constants.ts`, generated namespace/changelog pages, all 44 MDX pages, assistant prompt/context, search and `llms` exports.
- Blog content, Open Graph metadata, static covers and benchmark/stat labels. Decorative bars are not measurements.
- MCP embedded docs, program manifests and walkthroughs; status probe targets and example environment/deployment configuration.

Success means the existing design renders with truthful NEAR content and actual native decisions. It does not require a new dashboard, new design system, another asset, additional facilitators or all 21 old tools.

## Pre-import planning audit

Completed here: source SHA/clean-state check; license inspection; direct file and package-script inventory; docs generator/context tracing; bounded stale-content/workflow review. No secrets were collected. The source reference was not modified.

At the planning audit, source import and every implementation/runtime check were pending. T01 below now records the completed import; native implementation, dependency installation, frontend build/visual checks, tool integration, runtime test, chain deployment and working NEAR purchase remain unverified. The sprint ledger must record these only when they actually happen.

## T01 selective import record

The visual source was imported on 11 November 2026 from the exact upstream commit above. [ui-baseline-manifest.json](ui-baseline-manifest.json) lists every imported path, byte length and SHA-256, plus every exclusion within the selected source roots. It contains **345 imported files** (6,693,319 bytes) and **43 exclusions**. All imported bytes were checked against both the clean reference checkout and its pinned Git objects. `LICENSE` preserves the upstream MIT notice.

The import includes `web/`, the docs application/content and their referenced local assets/configuration. It deliberately excludes the docs environment template, obsolete deployment instructions, historical screenshots/Lighthouse results, and standalone browser/link-audit scripts. No upstream root workspace, `.github` workflow, deployment configuration, signer, Solana execution script, Git metadata or credentials was imported. Existing docs generation scripts remain as inert source for T25 to migrate; no install, lifecycle, build, browser, service or chain command was run in T01.

Before the T01 commit, verify the working copy with `python3 scripts/verify-ui-baseline.py`. After native adaptation starts, verify the preserved import with `python3 scripts/verify-ui-baseline.py --ref upstream-ui-baseline`. The tag is created by the accepting task commit, not by the importer. The manifest is provenance, not NEAR build or runtime evidence. Upstream copy, package scripts and proof claims are still unchanged in this baseline and must not be published as native functionality; their migrations remain T21–T25.
