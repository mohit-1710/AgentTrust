# AgentTrust docs site

Fumadocs + Next.js documentation site for AgentTrust on Monad.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # production build
pnpm lint
```

## Environment

Ask-AI uses an Anthropic key (default) or an OpenAI key on the server route at
`app/api/ask/route.ts`. For local testing:

```bash
cp .env.example .env.local
# then set ANTHROPIC_API_KEY=... (or OPENAI_API_KEY=...)
```

Do not commit `.env.local`. It is ignored by `.gitignore`.

## Content

Docs pages live in `content/docs` as MDX, organized into getting-started,
architecture, programs (PolicyVault + ERC-8004 registries), the x402 server,
the MCP server, integration guides, verification, and reference sections.
Shared chain facts and addresses live in `lib/constants.ts`. MDX components
are registered in `components/mdx.tsx`.

The `prebuild`/`predev` generator scripts (changelog, namespaces) skip
gracefully when their upstream source files are not present, so the baked-in
content is preserved.

## Monad chain facts

Monad testnet — chainId `10143`, RPC `https://testnet-rpc.monad.xyz`,
explorer `https://testnet.monadexplorer.com`. Deployed addresses are listed in
`content/docs/reference/devnet-program-ids.mdx` and `lib/constants.ts`.
