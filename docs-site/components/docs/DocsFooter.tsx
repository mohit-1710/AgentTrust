import type { JSX } from 'react';
import { GITHUB_REPO, LICENSE } from '@/lib/constants';

type FooterLink = {
  label: string;
  href: string;
  display: string;
  external: boolean;
};

const LINKS: ReadonlyArray<FooterLink> = [
  {
    label: 'Repo',
    href: `https://${GITHUB_REPO}`,
    display: GITHUB_REPO,
    external: true,
  },
  {
    label: 'SDK',
    href: 'https://www.npmjs.com/package/@monad-agenttrust-sdk/sdk',
    display: '@monad-agenttrust-sdk/sdk',
    external: true,
  },
  {
    label: 'MCP',
    href: 'https://www.npmjs.com/package/@monad-agenttrust-sdk/sdk',
    display: '@monad-agenttrust-sdk/sdk',
    external: true,
  },
  {
    label: 'Demo',
    href: 'https://monadagenttrustweb.vercel.app',
    display: 'monadagenttrustweb.vercel.app',
    external: true,
  },
];

export function DocsFooter(): JSX.Element {
  return (
    <footer className="docs-footer">
      {LINKS.map(({ label, href, display, external }) => (
        <a
          key={label}
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          className="docs-footer-link"
        >
          <span className="docs-footer-label">{label}</span>
          <code>{display}</code>
        </a>
      ))}
      <span className="license-badge">{LICENSE}</span>
    </footer>
  );
}
