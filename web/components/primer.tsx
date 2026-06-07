import { Vault, Star, Coins } from "lucide-react";

const CARDS = [
  {
    icon: Vault,
    term: "PolicyVault",
    blurb:
      "A non-custodial contract that holds each payer's spending rules — per-tx and daily caps, a velocity limit, a reputation threshold, and a kill switch. Its gate() view answers one question: should this payment happen?",
  },
  {
    icon: Star,
    term: "ERC-8004 reputation",
    blurb:
      "An open on-chain registry where attestors rate agents. The payer chooses which attestors it trusts, and the gate reads the average of their ratings — so reputation can't be faked by an agent rating itself.",
  },
  {
    icon: Coins,
    term: "x402 settlement",
    blurb:
      "The payment rail for agents. AgentTrust slots the gate into the x402 verify → settle path, so an Allow lets the USDC transfer proceed and a Deny stops it before any funds move.",
  },
];

export function Primer() {
  return (
    <div className="grid gap-px overflow-hidden rounded-[10px] border border-border bg-border md:grid-cols-3">
      {CARDS.map((c) => (
        <div key={c.term} className="flex flex-col bg-bg-elev p-6">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-soft text-accent">
            <c.icon className="h-5 w-5" />
          </span>
          <div className="mt-4 font-display text-lg font-semibold tracking-[-0.02em] text-ink">
            {c.term}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">{c.blurb}</p>
        </div>
      ))}
    </div>
  );
}
