import Link from "next/link";
import { Logo } from "./logo";
import { Badge } from "./ui/badge";

const NAV = [
  { href: "#demo", label: "Live demo" },
  { href: "#tools", label: "Try it" },
  { href: "#primer", label: "How it works" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-elev/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
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
          <Link
            href="#demo"
            className="btn-primary inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px] uppercase tracking-[0.04em] text-white"
          >
            Run the demo
          </Link>
        </div>
      </div>
    </header>
  );
}
