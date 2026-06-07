import { Identicon } from "./identicon";
import { SAMPLE_PAYER } from "@/lib/demo";
import { explorerAddress } from "@/lib/chain";
import { shortAddr } from "@/lib/utils";
import { ChevronDown, ExternalLink } from "lucide-react";

/**
 * Signed-in context strip. Frames the whole page as the presenter's own
 * logged-in control panel: their agent's account, its address, and the
 * network it's operating on.
 */
export function AccountBar() {
  return (
    <div className="border-b border-border bg-bg-dark text-white">
      <div className="mx-auto flex h-10 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-white/55">
          <span className="hidden sm:inline">AgentTrust dashboard</span>
          <span className="hidden sm:inline text-white/25">/</span>
          <span className="text-white/80">Signed in</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-white/55 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-allow animate-pulse-soft" />
            Monad testnet · 10143
          </span>
          <a
            href={explorerAddress(SAMPLE_PAYER)}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-2.5 transition-colors hover:border-white/30 hover:bg-white/10"
          >
            <Identicon address={SAMPLE_PAYER} className="h-6 w-6" />
            <span className="flex flex-col leading-tight">
              <span className="font-mono text-[11px] text-white">Your agent</span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-white/55">
                {shortAddr(SAMPLE_PAYER, 4)}
                <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          </a>
        </div>
      </div>
    </div>
  );
}
