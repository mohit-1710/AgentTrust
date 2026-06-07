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
            A non-custodial pre-payment gate for AI-agent payments on Monad.
          </span>
        </Link>

        <Link href="/getting-started/quickstart" className="not-found-card">
          <span className="not-found-card-eyebrow">Get started</span>
          <span className="not-found-card-title">Quickstart</span>
          <span className="not-found-card-body">
            Install the SDK, gate a payment, read a reputation score.
          </span>
        </Link>

        <Link href="/programs/policy-vault" className="not-found-card">
          <span className="not-found-card-eyebrow">Contract</span>
          <span className="not-found-card-title">PolicyVault</span>
          <span className="not-found-card-body">
            The gate contract — gate, setPolicy, setKillSwitch, recordSpend.
          </span>
        </Link>
      </div>
    </main>
  );
}
