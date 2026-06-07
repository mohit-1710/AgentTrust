import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import Link from 'next/link';
import { baseOptions } from '@/lib/layout.shared';
import { AskAIWidget } from '@/components/ask-ai/AskAIWidget';
import { AgentTrustLogoMark } from '@/components/docs/AgentTrustLogoMark';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="docs-topbar" aria-label="AgentTrust docs navigation">
        <a className="docs-topbar-brand" href="https://agenttrust.tech">
          <AgentTrustLogoMark className="agenttrust-brand-mark" />
          <span>AgentTrust</span>
        </a>
        <nav aria-label="Docs links">
          <span className="docs-topbar-primary">
            <Link aria-current="page" href="/">
              Documentation
            </Link>
            <Link href="/programs/policy-vault">Programs</Link>
            <Link href="/sdk">SDK</Link>
          </span>
          <span className="docs-topbar-secondary">
            <a href="https://github.com/agenttrust-labs/agenttrust">GitHub</a>
            <a href="https://agenttrust.tech">Launch app</a>
          </span>
        </nav>
      </header>
      <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
        {children}
        <AskAIWidget />
      </DocsLayout>
    </>
  );
}
