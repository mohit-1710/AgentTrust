# AgentTrust native NEAR docs

The preserved Fumadocs/Next.js shell serves the native documentation in `content/docs`. The 11 historical pages in `archive/upstream-docs` are outside the collection, search and assistant corpus. This private preparation does not claim a live docs domain or deployed product.

From the repository root, with the pinned tools loaded:

```sh
. scripts/env.sh
pnpm --filter docs-site generate
pnpm --filter docs-site check:generated
pnpm --filter docs-site check:corpus
pnpm --filter docs-site test:search
pnpm --filter docs-site types:check
pnpm --filter docs-site build
```

`generate` explicitly runs the two reviewed native block generators and Fumadocs' local `.source` generator. The capability table reads the native profile validator; the implementation table reads only explicit accepted-task entries in the sprint ledger. Both include source hashes and support a read-only drift check. There are no install/prebuild/predev hooks; the root package manager configuration keeps lifecycle scripts disabled.

`pnpm build:surfaces` invokes generation, corpus checks, the website build and the docs build. This is a compilation check, not runtime, deployment, website-claim or visual acceptance.

To view the production build locally:

```sh
pnpm --filter docs-site exec next start -p 3001
```

The normal Fumadocs search dialog calls `/api/search`. The server matches literal query terms against the current pages using ordinary arrays; no search database or semantic-search provider is started. `/llms.txt`, `/llms-full.txt` and each page's Markdown action use the same active collection.

Ask AI remains visually available but returns an honest unavailable state by default. A server operator must explicitly set `ASK_AI_ENABLED=true` and a server-only `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to enable paid provider requests. Anthropic is preferred when both keys exist. `GET /api/ask` reports availability without calling a provider. This task does not run paid requests or establish answer quality. Never place provider secrets or owner/deploy/worker keys in a browser bundle, docs content or Git.

Before release, inspect desktop/mobile rendering, keyboard search and copy-page behavior, and the assistant unavailable state. If a live assistant is separately enabled, verify source-cited answers against current native behavior and its pending runtime gates. The implementation snapshot must be refreshed when additional tasks are accepted.
