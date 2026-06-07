import Link from "next/link";
import { Logo } from "./logo";
import { Badge } from "./ui/badge";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#reputation" className="transition-colors hover:text-foreground">
            Reputation
          </a>
          <a href="#gate" className="transition-colors hover:text-foreground">
            Gate
          </a>
          <a href="#demo" className="transition-colors hover:text-foreground">
            Live Demo
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-allow animate-pulse" />
            Monad Testnet
          </Badge>
          <Link
            href="#demo"
            className="rounded-lg bg-monad-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-monad-500/25 transition-colors hover:bg-monad-400"
          >
            Run the demo
          </Link>
        </div>
      </div>
    </header>
  );
}
