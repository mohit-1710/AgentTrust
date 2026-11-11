# Preserve the interface; replace the chain-dependent data

Inspected against AgentTrust revision `21a3b111b7677d0b06ab1b063d647e4f52ea3b17`. The existing UI can be carried over. Its technical statements, routes, examples, and data readers need a deliberate migration rather than a global word replacement.

## Actual frontend surfaces

| Surface | Existing implementation | Port action |
|---|---|---|
| Marketing website | `web/`: Next.js 16.2.4, React 19.2.4, CSS modules/Tailwind, GSAP, Lenis, motion, Lottie, local fonts and media | Retain structure, styling, illustrations, animation code, responsive layouts, section order, and reusable components. Change the content/data modules and links. |
| Documentation website | `docs-site/`: Next.js 16.2.4, Fumadocs UI/core 16.8.7, Fumadocs MDX 14.3.2 | Keep sidebar, search, top bar, page layout, dark mode, code-block treatment, and Ask AI interface. Rewrite NEAR semantics and examples. |
| Decisions feed | Both `web/app/(marketing)/decisions/page.tsx` and `live-app/app/page.tsx` | Retain table layout; replace Solana RPC/log parsing and amount formatting. Either maintain both consistently or redirect one to the canonical feed. |
| Status page | `status-page/`, server-side GET probes | Keep presentation, point probes to the new deployment, and replace Solana health fields. A 200 health response must not claim successful settlement. |
| SDK/MCP/demo links | Central data/config files plus docs content | Point to the actual NEAR fork/package/deployments. Do not leave CTAs installing the Solana SDK or using the original team's write endpoints. |

Package versions above describe the source snapshot, not an instruction to upgrade all dependencies. Preserve the starting toolchain and check compatibility during implementation; a UI port does not justify a framework migration. [Workspace](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/pnpm-workspace.yaml), [web package](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/package.json), [docs package](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/docs-site/package.json).

## The content seams already support this

Most landing-page copy is separated from layout in `web/data/`: `hero.ts`, `heroSdk.ts`, `stats.ts`, `programs.ts`, `performance.ts`, `storytelling.ts`, `plugAndPlay.ts`, `trilemma.ts`, `network.ts`, `navigation.ts`, `links.ts`, and others. Rewrite the relevant data without restyling the component tree. Check blog posts, Open Graph metadata, sitemap, legal/contact links, and static media for embedded chain-specific copy as well.

Important examples:

| Current statement/data | Accurate NEAR replacement |
|---|---|
| “Live on Solana devnet” | “NEAR testnet” only after actual deployment and evidence. Until then label the work as in development. |
| Three Anchor programs / three program IDs | Three logical modules in the proposed core contract, with the actual deployed account and method/module names. The same three cards can stay; they must not invent three separate deployments. |
| One atomic transaction for policy + SPL transfer + feedback | Policy-enforced dispatch followed by asynchronous settlement tracking. Internal balance settlement may have a narrower atomic guarantee; external transfers do not inherit it. |
| 7/7 Kani proofs, 662 sub-checks | Only new, actually executed verification results for this port. Original pure-function properties may be adapted, but the old result is not evidence for NEAR callbacks or access control. |
| Quantu tier / `AtomStats` offsets | Provenance-labeled native attestation/reputation data or a clearly identified external provider, with subject, signer, expiry, and policy acceptance rules. |
| Pay.sh/Dexter/MCPay as live integrations | Only adapters actually implemented and verified for NEAR. Label later integrations as planned rather than keeping their live badges. |
| USDC with hardcoded six decimals | Native NEAR with 24 decimals for the recommended first milestone; token-specific integer amounts/metadata if an FT route is added. Never relabel test tokens as issuer-backed USDC. |
| Solana explorer URLs and transaction signatures | NEAR account, transaction, and receipt locators appropriate to testnet. Show the settlement status separately from the initial gate decision. |

Source: [hero](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/data/hero.ts), [program cards](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/data/programs.ts), [stats](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/data/stats.ts#L6-L20), [performance](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/data/performance.ts#L38-L65), [public links](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/data/links.ts).

The bar graphics in `web/data/performance.ts` are literal height values, not collected NEAR benchmarks. Preserve them as decorative visuals with suitable language, or replace them with measured evidence before calling them performance data.

## Decisions feed: the backend change matters

The existing feed polls `getSignaturesForAddress`, calls `getTransaction`, decodes Anchor event discriminators from base64 log lines, formats every amount as six-decimal USDC, and uses Solana explorer links. Both copies contain this logic. This cannot point at NEAR merely by changing `RPC_URL`.

Recommended first implementation: bounded, paginated view methods over recent decision/settlement records in the core contract. The web UI reads those methods, deduplicates by canonical payment ID, and renders `Deny`, `RequireValidation`, `Pending`, `Settled`, `Failed`, or `NeedsReconciliation` accurately. Include amount+asset, counterparty, denial reason, timestamp, and receipt/transaction link. Use structured NEP-297 logs as an additional indexer/event source, not an assumption that ordinary NEAR RPC provides Solana-style address transaction history.

View snapshots can lag and requests can fail. Preserve loading/error states; never fabricate success rows. A returned `Allow` or successful top-level transaction is not enough to display `Settled`. For decisions returned by a panicking receipt, do not assume durable on-chain denial records exist: return a typed denial normally when a committed denial/event is intended.

Sources: [web feed](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/web/app/%28marketing%29/decisions/page.tsx), [standalone feed](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/live-app/app/page.tsx), [status probes](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/status-page/lib/surfaces.ts).

## Documentation inventory and rewrite map

The inspected source contains **44 MDX pages** under `docs-site/content/docs`: 9 programs/policies, 6 integration guides, 6 MCP, 7 verification, 4 SDK, 8 reference, 1 getting-started, and 3 root pages. Preserve the visual shell and useful navigation shape; rewrite chain-dependent content in each category.

| Documentation area | Content required for the NEAR edition |
|---|---|
| Introduction / quickstart | Fund a testnet vault, create a policy, authorize a restricted agent key, execute an allowed payment, observe a blocked payment, follow terminal receipt status. State prerequisites and expected output. |
| Architecture | NEAR accounts, vault custody, direct session authentication, async receipts/callbacks, local trust state, and pending-balance reservations. |
| PolicyVault / five policies | Timestamp windows, per-asset integer budgets, limits including reservations, pause behavior, accepted issuers, expiry/revocation, treatment of unknown recipients. |
| TrustGate | Contract method arguments/returns, domain-bound payment IDs, settlement state transitions, idempotency, and callback failure handling. |
| ValidationRegistry | NEAR account-bound subject IDs, namespaces, issuer authorization, capability scope, evidence hash, expiry/revocation, versioning. No Quantu/PDA byte offsets. |
| SDK | Preserve useful high-level concepts (`verify`, execute/settle, `receipt`) while replacing PublicKey/Anchor/BN/SPL internals with NEAR AccountId, U128 strings, signer interfaces, transaction/receipt results. |
| MCP | Native read tools, local agent signing, key installation/revocation instructions; hosted surface read-only. Publish only the actual tool inventory. |
| Adapters | Native NEAR HTTP-402 demo explicitly scoped; FT/x402/Market adapters only when interoperable and tested. Solana-specific guides may remain as labeled historical source, not NEAR instructions. |
| Verification | Actual unit/property tests, receipt-chain failure tests, session authority tests, reproducible testnet traces and hashes. Remove inherited live proof badges. |
| Reference | Deployed account IDs, network, code hash/revision, method schemas, errors, event schema, assets/decimals, trust provider/issuer identities, and upgrade authority. |

Two root/quickstart aliases and legacy route names exist in the source. Audit actual links rather than assuming every URL named in a data file maps directly to an MDX file. Keep old useful routes as redirects where necessary; a fork need not preserve stale Solana-only URLs as current instructions.

## Search, Ask AI, generated content

The docs assistant builds its prompt by recursively loading **every** MDX file under `content/docs`, then caching the result. Leaving obsolete Solana claims in apparently unused pages can still contaminate Ask AI. The migration must update that entire corpus, search index, `llms.txt`, `llms-full.txt`, markdown routes, Open Graph cards, and generated namespace/changelog material together. Rebuild/redeploy to clear the process cache after content changes.

The prebuild namespace generator currently consumes `examples/attestor-demo/devnet-namespaces.json`, including Solana PDA/explorer fields. Replace its input schema and generated output with actual NEAR evidence. Do not execute old seed/deployment scripts simply to make docs generation pass.

Sources: [docs layout](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/docs-site/app/%28docs%29/layout.tsx), [source loader](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/docs-site/lib/source.ts), [assistant context](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/docs-site/lib/server/docs-context.ts#L35-L80), [namespace generator](https://github.com/agenttrust-labs/agenttrust/blob/21a3b111b7677d0b06ab1b063d647e4f52ea3b17/docs-site/scripts/build-namespaces-table.mjs).

## Acceptance checks for preserving the UI

These are proposed implementation checks, not completed test results:

1. Capture current landing/docs/decisions at desktop, tablet, and mobile; compare the port's typography, spacing, animation, layout, navigation, and responsive behavior.
2. Verify every CTA, explorer link, copied command, docs route, and SDK/MCP instruction reaches the NEAR edition intended by the user.
3. Scan all rendered content, MDX, metadata, assistant context, and generated artifacts for stale Solana/Anchor/PDA/SPL/Quantu/program-ID/proof/deployment claims. Historical labeled references are acceptable; misleading active instructions are not.
4. Render real allowed, denied, needs-validation, pending, failed, settled, and reconciliation-needed states. Assert that uncertain receipt status never appears as settled.
5. Verify token amounts using exact integer arithmetic; avoid converting large U128 values through JavaScript Number for accounting.
6. Run existing relevant frontend build/type/lint checks after source changes; then exercise the complete demo manually with actual NEAR outcomes. A successful build alone is not a successful port.

Preserve the upstream MIT license and disclose reused UI/docs/source in the new README as required by the event. Keep the existing design; make the new integration and its guarantees legible.
