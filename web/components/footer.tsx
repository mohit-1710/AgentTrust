import { Logo } from "./logo";
import {
  REPUTATION_REGISTRY,
  USDC,
  POLICY_VAULT_ADDRESS,
} from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { shortAddr } from "@/lib/utils";

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
          <Logo />
          <p className="text-sm leading-relaxed text-ink-dim">
            The non-custodial trust gate for AI-agent payments on Monad. It
            reads on-chain ERC-8004 reputation and the payer&apos;s policy, then
            allows or blocks each USDC payment before it settles.
          </p>
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
