import { Logo } from "./logo";
import { Badge } from "./ui/badge";

const SITE_URL = "https://monadagenttrustsite.vercel.app";
const DOCS_URL = "https://monadagenttrustdocs-site.vercel.app";

// Mirrors the marketing-site navbar: a Home link back to the site, the on-page
// Demo sections, and a Docs link — so the demo reads as one product, not a
// separate app.
const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: SITE_URL, label: "Home", external: true },
  { href: "#demo", label: "Live demo" },
  { href: "#policy", label: "Your policy" },
  { href: "#tools", label: "Try it" },
  { href: "#primer", label: "How it works" },
  { href: DOCS_URL, label: "Docs", external: true },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-elev/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a
          href={SITE_URL}
          aria-label="AgentTrust home"
          className="transition-opacity hover:opacity-80"
        >
          <Logo />
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              {...(n.external
                ? { rel: "noopener noreferrer" }
                : {})}
              className="mono-label rounded-md px-3 py-2 text-[12px] text-ink-dim transition-colors hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-allow animate-pulse-soft" />
            Monad Testnet
          </Badge>
          <a
            href="#demo"
            className="btn-primary inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px] uppercase tracking-[0.04em] text-white"
          >
            Run the demo
          </a>
        </div>
      </div>
    </header>
  );
}
