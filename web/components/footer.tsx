import { Logo } from "./logo";
import { REPUTATION_REGISTRY, USDC } from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { shortAddr } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-md text-sm text-muted-foreground">
            Non-custodial pre-payment policy gate for AI-agent payments on Monad.
            Built for Monad Blitz Bangalore.
          </p>
        </div>
        <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
          <div>
            Reputation:{" "}
            <a
              className="text-monad-200 hover:underline"
              href={explorerAddress(REPUTATION_REGISTRY)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(REPUTATION_REGISTRY, 6)}
            </a>
          </div>
          <div>
            USDC:{" "}
            <a
              className="text-monad-200 hover:underline"
              href={explorerAddress(USDC)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(USDC, 6)}
            </a>
          </div>
          <div>chainId 10143 · testnet-rpc.monad.xyz</div>
        </div>
      </div>
    </footer>
  );
}
