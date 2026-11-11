# AgentTrust Landing

Next.js App Router landing page for AgentTrust.

## Development

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

Open `http://localhost:3000`.

## Engineering Bar

Future work in this app must optimize for maintainability first, then visual craft. Do not land large, clever files when a small composition of focused modules would do.

- **HLD first:** keep route ownership in `app/`, reusable UI in `components/`, static typed content in `data/`, pure helpers in `lib/`, and hooks in `hooks/`.
- **LLD by SRP:** one component per file, PascalCase filename, explicit props interfaces, and a soft cap of about 150 lines for component files.
- **SOLID defaults:** prefer composition over inheritance-like abstractions, keep public interfaces narrow, avoid shared mutable state, and extract only after a third real use.
- **Server by default:** use React Server Components unless a leaf needs browser APIs, animation state, or event handlers.
- **Type safety:** `strict` TypeScript, no `any`, no non-null assertions, no untyped public functions.
- **Data discipline:** no inline magic constants for copy, stats, section labels, or program IDs. Put them in typed `data/` modules.
- **Animation discipline:** GSAP and motion code stays scoped, cleanup-safe, and respectful of reduced motion. Heavy visual experiments belong in references until approved.
- **Hygiene:** no `console.log`, commented-out code, unused imports, or dead prototype files in `web/`.
- **Verification:** run `pnpm lint`, `pnpm build`, and Playwright visual checks before considering a section done.

Commit stable checkpoints with direct names. Do not push unless explicitly requested.
