# AgentTrust docs site

Fumadocs + Next.js docs site for `docs.agenttrust.tech`.

## Commands

```bash
pnpm --filter docs-site dev
pnpm --filter docs-site lint
pnpm --filter docs-site types:check
pnpm --filter docs-site build
```

Local dev runs at `http://localhost:3001` when started with:

```bash
pnpm --filter docs-site exec next dev -p 3001
```

## Environment

Ask-AI uses `OPENAI_API_KEY` on the server route at `app/api/ask/route.ts`.
For local testing:

```bash
cp docs-site/.env.example docs-site/.env.local
```

Then edit `docs-site/.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

Do not commit `.env.local`. It is ignored by `docs-site/.gitignore`.

Cost-monitor note: ~$0.003 per question at gpt-4o-mini pricing; ~$3 per 1000 questions.

## Content

Docs pages live in `content/docs`. The current IA has 25 MDX pages:

- 9 full pages: introduction, quickstart, architecture overview, 3 program pages, SDK overview, x402 facilitator guide, devnet program IDs.
- 16 source-linked stubs for policy subpages, SDK details, integration guides, and reference pages.

Shared facts live in `lib/constants.ts`. MDX components are registered in `components/mdx.tsx`.

## Verification

Before committing docs-site changes:

```bash
pnpm --filter docs-site lint
pnpm --filter docs-site types:check
pnpm --filter docs-site build
```

Then verify `/` and any touched pages in Playwright at desktop, tablet, and mobile widths.
