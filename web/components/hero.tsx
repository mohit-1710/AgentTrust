import { Badge } from "./ui/badge";
import { ShieldCheck, Zap, Network } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(60%_60%_at_50%_0%,#000_30%,transparent_100%)] animate-grid-flow" />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <Badge variant="default" className="mx-auto mb-6 font-mono">
            <ShieldCheck className="h-3.5 w-3.5" />
            Non-custodial · ERC-8004 · x402
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            The safety layer that stops your{" "}
            <span className="text-gradient">AI agent</span> from paying{" "}
            <span className="text-deny">scammers</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            AgentTrust is a pre-payment policy gate for autonomous agents on
            Monad. It reads the payee&apos;s on-chain reputation and enforces your
            spending rules <span className="text-foreground">before a single
            dollar of USDC moves</span> — then settles trusted payments at Monad
            speed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#demo"
              className="rounded-lg bg-monad-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-monad-500/30 transition-colors hover:bg-monad-400"
            >
              See blocked → allowed
            </a>
            <a
              href="#reputation"
              className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Check a live agent&apos;s reputation
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Reputation-gated",
              body: "Pay only agents your trusted attestors have vouched for on-chain.",
            },
            {
              icon: Network,
              title: "Non-custodial",
              body: "The gate holds no funds. It only answers: should this payment happen?",
            },
            {
              icon: Zap,
              title: "Monad-fast",
              body: "Gate is a free view call, inline in the x402 verify → settle path.",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card/50 glass p-5 text-left animate-fade-up"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <f.icon className="mb-3 h-5 w-5 text-monad-300" />
              <div className="text-sm font-semibold">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
