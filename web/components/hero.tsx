import { ArrowRight, ShieldX, ShieldCheck, ScanLine } from "lucide-react";

const FLOW = [
  {
    icon: ScanLine,
    title: "Agent wants to pay",
    body: "An autonomous agent is about to send USDC to another agent for a service.",
  },
  {
    icon: ShieldCheck,
    title: "AgentTrust checks",
    body: "It reads the payee's on-chain ERC-8004 reputation and the payer's spending policy.",
  },
  {
    icon: ShieldX,
    title: "Allow · Deny · Validate",
    body: "A verdict is returned before a single dollar of USDC settles via x402.",
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(70%_60%_at_50%_0%,#000_25%,transparent_100%)] opacity-70" />
      {/* soft purple glow, like the site */}
      <div className="pointer-events-none absolute -top-24 right-[6%] h-72 w-72 rounded-full bg-[rgba(131,110,249,0.25)] blur-[80px]" />

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 md:pb-20 md:pt-24">
        <div className="max-w-3xl animate-fade-up">
          <p className="mono-label text-[11px] text-accent">
            Live on Monad testnet · ERC-8004 reputation gate · chainId 10143
          </p>

          <h1 className="mt-6 font-display text-[2.5rem] font-semibold leading-[0.99] tracking-[-0.04em] text-ink md:text-[4.25rem]">
            Watch an AI agent get blocked from paying a{" "}
            <span className="italic text-deny">scammer</span> — live on Monad.
          </h1>

          <div className="my-7 h-px w-full bg-border" />

          <p className="max-w-2xl text-lg leading-relaxed text-ink-dim">
            AgentTrust is the non-custodial trust gate for AI-agent payments. An
            agent wants to pay, AgentTrust checks the payee&apos;s on-chain
            reputation and the payer&apos;s policy, then returns{" "}
            <span className="font-medium text-ink">Allow</span>,{" "}
            <span className="font-medium text-ink">Deny</span>, or{" "}
            <span className="font-medium text-ink">Require Validation</span> —
            before any USDC moves.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#demo"
              className="btn-primary inline-flex h-11 items-center gap-2 rounded-full px-6 font-mono text-[13px] uppercase tracking-[0.04em] text-white"
            >
              See blocked → allowed <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#tools"
              className="btn-secondary inline-flex h-11 items-center rounded-full px-6 font-mono text-[13px] uppercase tracking-[0.04em]"
            >
              Try the gate yourself
            </a>
          </div>
        </div>

        {/* The flow, in three editorial steps */}
        <div className="mt-14 grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-3">
          {FLOW.map((f, i) => (
            <div
              key={f.title}
              className="bg-bg-elev p-6 animate-fade-up"
              style={{ animationDelay: `${140 + i * 90}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-accent-soft text-accent">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="mono-label text-[10px] text-ink-dim">
                  Step {i + 1}
                </span>
              </div>
              <div className="mt-4 font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                {f.title}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
