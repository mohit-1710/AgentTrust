import { Logo } from "./logo";
import {
  REPUTATION_REGISTRY,
  USDC,
  POLICY_VAULT_ADDRESS,
} from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { shortAddr } from "@/lib/utils";

const SITE_URL = "https://monadagenttrustsite.vercel.app";
const DOCS_URL = "https://monadagenttrustdocs-site.vercel.app";
const GITHUB_URL = "https://github.com/mohit-1710/AgentTrust";
const X_URL = "https://x.com/agenttrustlabs";

const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: SITE_URL, label: "Home" },
  { href: DOCS_URL, label: "Docs" },
  { href: GITHUB_URL, label: "GitHub" },
  { href: X_URL, label: "X" },
];

function ContractRow({
  label,
  address,
}: {
  label: string;
  address: string | null;
}) {
  if (!address) return null;
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-ink-dim">{label}</span>
      <a
        className="text-monad-700 hover:underline"
        href={explorerAddress(address)}
        target="_blank"
        rel="noreferrer"
      >
        {shortAddr(address, 6)}
      </a>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-elev">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-3">
          <a
            href={SITE_URL}
            aria-label="AgentTrust home"
            className="inline-flex transition-opacity hover:opacity-80"
          >
            <Logo />
          </a>
          <p className="text-sm leading-relaxed text-ink-dim">
            The non-custodial trust gate for AI-agent payments on Monad. It
            reads on-chain ERC-8004 reputation and the payer&apos;s policy, then
            allows or blocks each USDC payment before it settles.
          </p>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {FOOTER_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                rel="noopener noreferrer"
                className="mono-label text-[12px] text-ink-dim transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="w-full max-w-xs space-y-2 font-mono text-xs">
          <div className="mono-label mb-3 text-[10px] text-accent">
            Deployed on Monad testnet
          </div>
          <ContractRow label="PolicyVault" address={POLICY_VAULT_ADDRESS} />
          <ContractRow label="ERC-8004 Reputation" address={REPUTATION_REGISTRY} />
          <ContractRow label="USDC" address={USDC} />
          <div className="flex items-center justify-between gap-6 pt-2 text-ink-dim">
            <span>Network</span>
            <span>chainId 10143</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
