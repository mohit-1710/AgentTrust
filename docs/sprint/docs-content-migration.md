# T24 documentation content migration

Initial content preparation used `f2f7bc0` (accepted T07), 11 November 2026. The T25 integration refresh uses `d360d15` (accepted T01–T12/T14/T15, prepared T13/T16), 12 November; this is not runtime acceptance. This inventory accounts for all **44** inherited MDX pages: **33 rewritten**, **11 archived**, plus **one new native trust/block page**, leaving **34 active pages**. It does not mark T24 accepted in the main sprint ledger.

The upstream source is `agenttrust-labs/agenttrust@21a3b111b7677d0b06ab1b063d647e4f52ea3b17`. [Baseline provenance](baseline.md) and the [exact import manifest](ui-baseline-manifest.json) remain authoritative for prior work and original SHA-256 values. The 11 archived MDX files are byte-identical to both that manifest and the preparation base. License notices remain unchanged.

## Active corpus and archive boundary

- Active MDX root: `docs-site/content/docs/`. The existing [Fumadocs collection](../../docs-site/source.config.ts) and recursive [assistant loader](../../docs-site/lib/server/docs-context.ts) both use this root; [search/source export](../../docs-site/lib/source.ts) consumes that collection.
- Historical archive: **`docs-site/archive/upstream-docs/`**, preserving each original relative path. It is outside the collection and assistant roots and has no active navigation or corpus link. Its [archive notice](../../docs-site/archive/upstream-docs/ARCHIVE.md) discloses historical status. Sidebar hiding alone would not have excluded a file from the recursive assistant loader.
- Rewritten paths retain useful upstream routes but change titles/content to native concepts. The old route names do not imply old-chain compatibility. The short `/quickstart` route remains a content pointer to `/getting-started/quickstart`; it is the only active page intentionally absent from navigation.
- Only existing `Cards`/`Card` presentation components appear in the new MDX. Content no longer invokes inherited proof or program-ID claim components.

## Original page mapping

Every path below is relative to the original `docs-site/content/docs/` root. **Rewrite** targets the same path under that active root. **Archive** targets the same path under `docs-site/archive/upstream-docs/`. Links resolve to the actual resulting file. Source labels refer to the code/specification groups below; every active page also carries direct source links.

| Original page / resulting file | Decision and native content or exclusion | Claim basis |
|---|---|---|
| [architecture.mdx](../../docs-site/content/docs/architecture.mdx) | Rewrite: Architecture | Architecture |
| [getting-started/quickstart.mdx](../../docs-site/content/docs/getting-started/quickstart.mdx) | Rewrite: Local quickstart | Commands, ledger |
| [index.mdx](../../docs-site/content/docs/index.mdx) | Rewrite: AgentTrust on NEAR | Scope, baseline |
| [integration-guides/capability-namespaces.mdx](../../docs-site/content/docs/integration-guides/capability-namespaces.mdx) | Rewrite: Configure the audit capability | Authority, registry, scope |
| [integration-guides/custom-attestor.mdx](../../docs-site/content/docs/integration-guides/custom-attestor.mdx) | Rewrite: Issuer validation flow | Architecture, registry, verification |
| [integration-guides/dexter-adapter.mdx](../../docs-site/archive/upstream-docs/integration-guides/dexter-adapter.mdx) | Archive: No third-party facilitator adapter in the native scope. | Scope, architecture, baseline |
| [integration-guides/facilitator-adapters.mdx](../../docs-site/archive/upstream-docs/integration-guides/facilitator-adapters.mdx) | Archive: No general multi-facilitator framework in the native scope. | Scope, architecture, baseline |
| [integration-guides/pay-sh-adapter.mdx](../../docs-site/archive/upstream-docs/integration-guides/pay-sh-adapter.mdx) | Archive: No live native integration with this upstream service. | Scope, architecture, baseline |
| [integration-guides/x402-facilitator.mdx](../../docs-site/content/docs/integration-guides/x402-facilitator.mdx) | Rewrite: Custom HTTP 402 purchase | Architecture, codecs, verification |
| [mcp/hosted-endpoint.mdx](../../docs-site/archive/upstream-docs/mcp/hosted-endpoint.mdx) | Archive: Hosted signer/transport is outside the frozen local MCP scope. | Scope, architecture, baseline |
| [mcp/index.mdx](../../docs-site/content/docs/mcp/index.mdx) | Rewrite: Local MCP tools | Architecture, scope |
| [mcp/install.mdx](../../docs-site/content/docs/mcp/install.mdx) | Rewrite: Worker configuration | Architecture, codecs |
| [mcp/prompts.mdx](../../docs-site/archive/upstream-docs/mcp/prompts.mdx) | Archive: No MCP prompt registry is included in the six-tool scope. | Scope, architecture, baseline |
| [mcp/resources.mdx](../../docs-site/archive/upstream-docs/mcp/resources.mdx) | Archive: No inherited resource catalog is part of the native six-tool scope. | Scope, architecture, baseline |
| [mcp/tools.mdx](../../docs-site/content/docs/mcp/tools.mdx) | Rewrite: Tool contract | Architecture, verification |
| [programs/policy-vault/composer.mdx](../../docs-site/content/docs/programs/policy-vault/composer.mdx) | Rewrite: Ordered payment decisions | Architecture, verification |
| [programs/policy-vault/counterparty-tier-policy.mdx](../../docs-site/archive/upstream-docs/programs/policy-vault/counterparty-tier-policy.mdx) | Archive: Numeric reputation/tier policy is removed; explicit service trust replaces the concept. | Scope, architecture, baseline |
| [programs/policy-vault/index.mdx](../../docs-site/content/docs/programs/policy-vault/index.mdx) | Rewrite: Native vault and sessions | Authority, funding |
| [programs/policy-vault/kill-switch-policy.mdx](../../docs-site/content/docs/programs/policy-vault/kill-switch-policy.mdx) | Rewrite: Pause and revocation | Authority, architecture |
| [programs/policy-vault/require-validation-policy.mdx](../../docs-site/content/docs/programs/policy-vault/require-validation-policy.mdx) | Rewrite: Required capability | Authority, registry, architecture |
| [programs/policy-vault/spending-policy.mdx](../../docs-site/content/docs/programs/policy-vault/spending-policy.mdx) | Rewrite: Spending and backing | Funding, architecture |
| [programs/policy-vault/velocity-policy.mdx](../../docs-site/content/docs/programs/policy-vault/velocity-policy.mdx) | Rewrite: Dispatch rate limit | Architecture, verification |
| [programs/trustgate.mdx](../../docs-site/content/docs/programs/trustgate.mdx) | Rewrite: Payment lifecycle | Architecture, verification |
| [programs/validation-registry.mdx](../../docs-site/content/docs/programs/validation-registry.mdx) | Rewrite: Service and credential registry | Registry |
| [quickstart.mdx](../../docs-site/content/docs/quickstart.mdx) | Rewrite: Quickstart | Commands |
| [reference/byte-offset-reference.mdx](../../docs-site/content/docs/reference/byte-offset-reference.mdx) | Rewrite: Canonical wire format | Codecs |
| [reference/capability-namespaces.mdx](../../docs-site/content/docs/reference/capability-namespaces.mdx) | Rewrite: Supported capability | Authority, registry, scope |
| [reference/changelog.mdx](../../docs-site/content/docs/reference/changelog.mdx) | Rewrite: Implementation status | Ledger, baseline |
| [reference/deny-reason-codes.mdx](../../docs-site/content/docs/reference/deny-reason-codes.mdx) | Rewrite: Decision codes | Architecture, authority, registry |
| [reference/devnet-program-ids.mdx](../../docs-site/content/docs/reference/devnet-program-ids.mdx) | Rewrite: Testnet configuration | Views, verification, scope |
| [reference/discriminator-constants.mdx](../../docs-site/content/docs/reference/discriminator-constants.mdx) | Rewrite: Signature domains and commitments | Codecs, architecture |
| [reference/mainnet-program-ids.mdx](../../docs-site/archive/upstream-docs/reference/mainnet-program-ids.mdx) | Archive: No production/mainnet deployment claim. | Scope, architecture, baseline |
| [reference/quantu-agent-registry.mdx](../../docs-site/archive/upstream-docs/reference/quantu-agent-registry.mdx) | Archive: No dependency on the upstream external registry. | Scope, architecture, baseline |
| [sdk/exports-reference.mdx](../../docs-site/content/docs/sdk/exports-reference.mdx) | Rewrite: Protocol exports | Codecs |
| [sdk/gate-payment.mdx](../../docs-site/content/docs/sdk/gate-payment.mdx) | Rewrite: Preview, execute and resume | Architecture, verification |
| [sdk/index.mdx](../../docs-site/content/docs/sdk/index.mdx) | Rewrite: Native TypeScript SDK | Codecs, architecture |
| [sdk/mount-trustgate.mdx](../../docs-site/archive/upstream-docs/sdk/mount-trustgate.mdx) | Archive: The old middleware mount API is not a native export. | Scope, architecture, baseline |
| [verification/adversarial-harness.mdx](../../docs-site/content/docs/verification/adversarial-harness.mdx) | Rewrite: Adversarial cases | Verification, authority, codecs |
| [verification/atomic-tx-invariant.mdx](../../docs-site/content/docs/verification/atomic-tx-invariant.mdx) | Rewrite: Asynchronous settlement invariants | Architecture, verification |
| [verification/chained-validation.mdx](../../docs-site/content/docs/verification/chained-validation.mdx) | Rewrite: Capability-to-purchase proof | Architecture, verification |
| [verification/devnet-smoke.mdx](../../docs-site/content/docs/verification/devnet-smoke.mdx) | Rewrite: Runtime and testnet runs | Commands, verification, scope |
| [verification/index.mdx](../../docs-site/content/docs/verification/index.mdx) | Rewrite: Verification | Verification, ledger |
| [verification/kani-proofs.mdx](../../docs-site/archive/upstream-docs/verification/kani-proofs.mdx) | Archive: Old proof results are not NEAR verification evidence. | Scope, architecture, baseline |
| [verification/live-evidence.mdx](../../docs-site/content/docs/verification/live-evidence.mdx) | Rewrite: Evidence and provenance | Verification, ledger |

New active page: [programs/policy-vault/service-trust.mdx](../../docs-site/content/docs/programs/policy-vault/service-trust.mdx) explains explicit owner approvals, exact identity/profile binding, service/payout blocks, revision changes and unknown-service refusal. Its authority is the frozen architecture and scope; it does not invent a numeric trust system.

Navigation changes are limited to the seven existing `meta.json` files under `programs`, `programs/policy-vault`, `integration-guides`, `mcp`, `sdk`, `reference` and `verification`. The root/getting-started taxonomy and visual shell are retained.

## Source groups

- **Scope:** [plan](plan.md), especially the fixed native-only scope and T08–T25 acceptance contracts.
- **Architecture:** [frozen architecture](architecture.md), including public ABI, authority, gates, accounting, asynchronous outcomes, SDK retry contract, HTTP routes and six local MCP tools. Planned behavior is identified as planned in the active docs.
- **Authority:** [domain owner transitions](../../crates/agenttrust-domain/src/owner.rs), [direct authority checks](../../crates/agenttrust-domain/src/authority.rs), [native owner wrappers](../../contracts/agenttrust-core/src/owner.rs) and [authority tests](../../crates/agenttrust-domain/tests/authority.rs).
- **Funding:** [pure accounting](../../crates/agenttrust-domain/src/accounting.rs) and [native funding/storage wrapper](../../contracts/agenttrust-core/src/owner.rs).
- **Registry:** [service/credential domain](../../crates/agenttrust-domain/src/registry.rs) and [native registry ABI](../../contracts/agenttrust-core/src/registry.rs).
- **Codecs:** [Rust types](../../crates/agenttrust-domain/src/types.rs), [canonical Rust encoding](../../crates/agenttrust-domain/src/codec.rs), [TypeScript implementation](../../packages/near-sdk/src/codec.ts), [actual exports](../../packages/near-sdk/src/index.ts), [private package manifest](../../packages/near-sdk/package.json), [TS tests](../../packages/near-sdk/test/codec.test.ts) and [shared fixture disclosure](../../fixtures/protocol/v1/README.md).
- **Views:** [implemented core observations](../../contracts/agenttrust-core/src/views.rs).
- **Commands:** [root script definitions](../../package.json) and [pinned toolchain record](toolchain.md).
- **Verification:** [acceptance/evidence requirements](verification.md). A required case is not described as a passed result.
- **Ledger:** [actual milestone record](ledger.md). No test-count or proof badges are copied into the active corpus.
- **Baseline:** [reuse boundary](baseline.md) and [source manifest](ui-baseline-manifest.json).

## T24 preparation checks performed

Only read-only validation of ordinary files and Git objects was executed; no install/build hooks, generators, servers, chain runtime, database operations or deployment ran.

- All 44 original paths mapped exactly once; each original hash matched the import manifest. All 11 archive copies matched original bytes and are absent from the active tree.
- All 34 active pages have valid JSON-quoted title/description frontmatter and balanced fenced blocks. The already-installed `unified` + `remark-parse` + `remark-mdx` parser parsed every body to an AST without errors; this was syntax parsing only, not compilation or rendering.
- All 40 active local links resolve to existing MDX routes. All 24 unique repository source paths referenced by active pages exist at the preparation base.
- All nine navigation metadata files parse and resolve; 33 pages are reachable through navigation and the retained short quickstart is the single intentional exception.
- Active content has no old chain/token/registry/adapter/package identifiers, old proof counts, inherited claim-component calls or archived navigation entries. Deliberate exclusion statements and the pinned prior-work disclosure remain.
- Whitespace validation uses `git diff --check`; archived original bytes remain unnormalized.

The repeatable static-check helpers and raw preparation results are local scratch artifacts under ignored `.sprint/`; this inventory records their scope rather than installing a new documentation tooling framework.

## Integration handoff

This is content preparation until rendered acceptance checks pass. The T25 refresh reconciles status, SDK interfaces, validator/audit behavior and runtime boundaries to the integrated milestones above. Later accepted tasks still require reconciliation against the ledger. In particular, a later implementation can update the quickstart, SDK/runtime and useful-audit grammar pages only with its actual exported interfaces, commands and observed results.

T25 preparation replaces the namespace/changelog generators with native source-derived blocks, removes unused old claim components/constants, migrates shell metadata/links and assistant context, and implements explicit `pnpm build:surfaces`. Local generation, source-hash drift checks, corpus/archive checks, search behavior tests, lint, typecheck and both production surface builds passed in its isolated worktree. Read-only HTTP checks covered all 34 active HTML and Markdown routes, all 11 archived routes returning 404, both LLM exports, four native search queries, negotiation and the assistant availability response. A direct execution of the actual context loader contained exactly 34 current pages. No provider request was made.

Search uses plain array matching instead of the inherited database-backed search constructor, retaining the existing dialog and response shape under the host database restriction. HTTP checks reproduced and fixed the inherited Markdown-negotiation rewrite loop. The inactive assistant preserves its panel with an explicit unavailable state. Desktop/mobile interaction and visual acceptance, separately enabled live assistant answer checks, and fresh integration review remain pending. The website build does not establish the website's separate T22 claim migration. T28 remains responsible for the final no-old-claim and evidence audit. No deployed IDs, credential hashes, public endpoints, measured benchmark values or live success results were fabricated.
