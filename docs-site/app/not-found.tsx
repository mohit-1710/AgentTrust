import Link from 'next/link';
import type { JSX } from 'react';

export default function NotFound(): JSX.Element {
  return (
    <main className="not-found">
      <p className="not-found-eyebrow">404 — page not found</p>
      <h1 className="not-found-title">This page has not been ratified.</h1>
      <p className="not-found-body">
        The URL doesn&rsquo;t resolve to a documented surface in AgentTrust. The links
        below are the most useful entry points if you&rsquo;re looking to start.
      </p>

      <div className="not-found-grid">
        <Link href="/" className="not-found-card">
          <span className="not-found-card-eyebrow">Home</span>
          <span className="not-found-card-title">AgentTrust overview</span>
          <span className="not-found-card-body">
            Three Anchor programs that complete the third leg of ERC-8004 on Solana.
          </span>
        </Link>

        <Link href="/getting-started/quickstart" className="not-found-card">
          <span className="not-found-card-eyebrow">Get started</span>
          <span className="not-found-card-title">Quickstart</span>
          <span className="not-found-card-body">
            Hit the live demo, install the SDK, wire the MCP server.
          </span>
        </Link>

        <Link href="/verification/live-evidence" className="not-found-card">
          <span className="not-found-card-eyebrow">Verification</span>
          <span className="not-found-card-title">Live evidence</span>
          <span className="not-found-card-body">
            Seven Kani proofs, devnet smoke traces, every claim with an Explorer URL.
          </span>
        </Link>
      </div>
    </main>
  );
}
