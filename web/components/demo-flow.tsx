"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { VerdictPanel } from "./verdict-badge";
import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/demo";
import { runGate, type GateResult } from "@/lib/gate";
import { explorerAddress } from "@/lib/chain";
import { REPUTATION_REGISTRY } from "@/lib/contracts";
import { cn, shortAddr } from "@/lib/utils";
import {
  Bot,
  Loader2,
  ArrowRight,
  ExternalLink,
  ShieldX,
  ShieldCheck,
} from "lucide-react";

interface RunState {
  status: "idle" | "running" | "done" | "error";
  result?: GateResult;
  error?: string;
}

function PayeeAvatar({ kind }: { kind: DemoScenario["key"] }) {
  const bad = kind === "scammer";
  return (
    <div
      className={cn(
        "grid h-12 w-12 place-items-center rounded-xl ring-1",
        bad
          ? "bg-deny/10 text-deny ring-deny/30"
          : "bg-allow/10 text-allow ring-allow/30"
      )}
    >
      {bad ? <ShieldX className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
    </div>
  );
}

export function DemoFlow() {
  const [states, setStates] = React.useState<Record<string, RunState>>({
    scammer: { status: "idle" },
    trusted: { status: "idle" },
  });
  const [stepRunning, setStepRunning] = React.useState(false);

  async function runScenario(s: DemoScenario) {
    setStates((p) => ({ ...p, [s.key]: { status: "running" } }));
    try {
      const result = await runGate({
        payer: "0x56665935703ECE0d7b16193035dEafA5Cc679A85",
        payeeAgentId: s.payeeAgentId,
        amount: BigInt(s.amount) * 1_000_000n,
        clients: s.clients,
      });
      setStates((p) => ({ ...p, [s.key]: { status: "done", result } }));
      return result;
    } catch (e) {
      setStates((p) => ({
        ...p,
        [s.key]: {
          status: "error",
          error: e instanceof Error ? e.message : "failed",
        },
      }));
      return null;
    }
  }

  async function runWalkthrough() {
    setStepRunning(true);
    setStates({ scammer: { status: "idle" }, trusted: { status: "idle" } });
    await runScenario(DEMO_SCENARIOS[0]);
    await new Promise((r) => setTimeout(r, 900));
    await runScenario(DEMO_SCENARIOS[1]);
    setStepRunning(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">
            Blocked → Allowed, live
          </h3>
          <p className="mt-1 text-muted-foreground">
            Same agent, same amount. The only thing that changes is{" "}
            <span className="text-foreground">whether your attestors trust
            the payee.</span> Both verdicts come from a live read on Monad
            testnet.
          </p>
        </div>
        <Button onClick={runWalkthrough} disabled={stepRunning} size="lg">
          {stepRunning ? (
            <>
              <Loader2 className="animate-spin" /> Running…
            </>
          ) : (
            <>
              Run full walkthrough <ArrowRight />
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {DEMO_SCENARIOS.map((s, i) => {
          const st = states[s.key];
          return (
            <Card
              key={s.key}
              className={cn(
                "relative overflow-hidden",
                s.key === "scammer"
                  ? "ring-1 ring-deny/20"
                  : "ring-1 ring-allow/20"
              )}
            >
              <span className="absolute right-4 top-4 font-mono text-xs text-muted-foreground">
                step {i + 1} / 2
              </span>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <PayeeAvatar kind={s.key} />
                  <div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription className="mt-0.5">
                      {s.subtitle}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-background/30 p-4 font-mono text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Bot className="h-4 w-4 text-monad-300" /> your agent
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{s.amount} USDC</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    agent #{s.payeeAgentId.toString()}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Trusted attestor for this step:{" "}
                  <a
                    href={explorerAddress(s.clients[0])}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-monad-200 hover:underline"
                  >
                    {shortAddr(s.clients[0])}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {st.status === "idle" && (
                  <Button
                    variant="subtle"
                    className="w-full"
                    onClick={() => runScenario(s)}
                  >
                    Ask the gate
                  </Button>
                )}
                {st.status === "running" && (
                  <div className="relative h-[88px] overflow-hidden rounded-2xl border border-border bg-background/30">
                    <div className="absolute inset-x-0 h-10 bg-gradient-to-b from-monad-500/30 to-transparent animate-scan" />
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="animate-spin" /> reading on-chain
                      reputation…
                    </div>
                  </div>
                )}
                {st.status === "done" && st.result && (
                  <VerdictPanel
                    decision={st.result.decision}
                    reason={st.result.reason}
                    source={st.result.source}
                  />
                )}
                {st.status === "error" && (
                  <div className="rounded-lg border border-deny/30 bg-deny/10 px-4 py-3 text-sm text-deny">
                    {st.error}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/40 glass px-5 py-4 text-sm">
        <Badge variant="default" className="font-mono">
          Monadscan
        </Badge>
        <span className="text-muted-foreground">
          On an ALLOW, the x402 settle path posts the USDC transfer — the tx hash
          links here:
        </span>
        <a
          href={explorerAddress(REPUTATION_REGISTRY)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-monad-200 hover:underline"
        >
          testnet.monadexplorer.com/tx/…
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
