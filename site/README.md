# AgentTrust marketing site

Next.js App Router landing page for AgentTrust — the non-custodial reputation firewall for AI-agent payments on Monad.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # production build
pnpm lint
```

## Layout

- `app/` — routes (marketing landing, blog, decisions feed, legal pages).
- `components/` — UI components and animation layers.
- `data/` — typed content modules (hero, programs, navigation, performance, etc.).
- `lib/` — pure helpers (scroll runtime, hero geometry, highlighter, posts loader).
- `hooks/` — React hooks.
- `posts/` — MDX blog posts.

## Monad chain facts

The deployed contracts surfaced in the UI target Monad testnet (chainId `10143`,
RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadexplorer.com`):

- PolicyVault `0x34b3bB1a99377128126201359749FE7614275E37`
- ERC-8004 IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ERC-8004 ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- ERC-8004 ValidationRegistry `0x8004Cb1BF31DAf7788923b405b754f57acEB4272`
- USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`
- x402 facilitator `https://x402-facilitator.molandak.org`

The live `/decisions` feed reads PolicyVault decision logs; the on-chain
subscription is a placeholder pending wiring to the Monad RPC.
