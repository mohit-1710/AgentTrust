"use client";

import * as React from "react";
import { VerdictPanel } from "./verdict-badge";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { DEMO_SCENARIOS, SAMPLE_PAYER, type DemoScenario } from "@/lib/demo";
import { runGate, type GateResult } from "@/lib/gate";
import { readReputation, type ReputationResult } from "@/lib/reputation";
import { POLICY_VAULT_ADDRESS } from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { cn, shortAddr } from "@/lib/utils";
import {
  Bot,
  Loader2,
  ArrowRight,
  ExternalLink,
  ShieldX,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

const VAULT = POLICY_VAULT_ADDRESS;

interface RunState {
  status: "idle" | "running" | "done" | "error";
  rep?: ReputationResult;
  result?: GateResult;
  error?: string;
}

const initial: Record<string, RunState> = {
  scammer: { status: "idle" },
  trusted: { status: "idle" },
};

function PayeeAvatar({ kind }: { kind: DemoScenario["key"] }) {
  const bad = kind === "scammer";
  return (
    <div
      className={cn(
        "grid h-12 w-12 place-items-center rounded-lg",
        bad
          ? "bg-[rgba(193,59,38,0.1)] text-deny"
          : "bg-[rgba(31,122,61,0.1)] text-allow"
      )}
    >
      {bad ? <ShieldX className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
    </div>
  );
}

function RepStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="panel-soft rounded-md px-3 py-2.5">
      <div className="mono-label text-[10px] text-ink-dim">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-semibold tracking-[-0.02em]",
          tone === "good" && "text-allow",
          tone === "bad" && "text-deny",
          (!tone || tone === "neutral") && "text-ink"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function DemoFlow() {
  const [states, setStates] = React.useState<Record<string, RunState>>(initial);
  const [stepRunning, setStepRunning] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState<number>(-1);

  async function runScenario(s: DemoScenario) {
    setStates((p) => ({ ...p, [s.key]: { status: "running" } }));
    try {
      const amount = BigInt(s.amount) * 1_000_000n;
      // Read reputation + gate in parallel — both are live on-chain views.
      const [rep, result] = await Promise.all([
        readReputation(s.payeeAgentId, s.clients),
        runGate({
          payer: SAMPLE_PAYER,
          payeeAgentId: s.payeeAgentId,
          amount,
          clients: s.clients,
        }),
      ]);
      setStates((p) => ({ ...p, [s.key]: { status: "done", rep, result } }));
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
    setStates(initial);
    setActiveStep(0);
    await runScenario(DEMO_SCENARIOS[0]);
    await new Promise((r) => setTimeout(r, 1100));
    setActiveStep(1);
    await runScenario(DEMO_SCENARIOS[1]);
    setActiveStep(-1);
    setStepRunning(false);
  }

  function reset() {
    setStates(initial);
    setActiveStep(-1);
  }

  const anyDone = Object.values(states).some((s) => s.status === "done");

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="panel flex flex-col items-start justify-between gap-4 rounded-[10px] p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Badge variant={VAULT ? "good" : "warn"}>
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
            {VAULT ? "PolicyVault.gate() · on-chain" : "Preview mode"}
          </Badge>
          <span className="font-mono text-xs text-ink-dim">
            Same payer, same 5 USDC — only the payee&apos;s reputation changes.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {anyDone && !stepRunning && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
          <Button onClick={runWalkthrough} disabled={stepRunning} size="lg">
            {stepRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running…
              </>
            ) : (
              <>
                Run walkthrough <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {DEMO_SCENARIOS.map((s, i) => {
          const st = states[s.key];
          const isActive = activeStep === i;
          const rep = st.rep;
          const avg = rep?.average ?? null;
          const repTone: "good" | "bad" | "neutral" =
            avg === null ? "neutral" : avg >= 70 ? "good" : "bad";

          return (
            <div
              key={s.key}
              className={cn(
                "panel relative flex flex-col rounded-[10px] p-6 transition-all duration-500",
                isActive && "ring-2 ring-accent/40",
                s.key === "scammer"
                  ? "shadow-[inset_3px_0_0_0_rgba(193,59,38,0.5)]"
                  : "shadow-[inset_3px_0_0_0_rgba(31,122,61,0.5)]"
              )}
            >
              <span className="mono-label absolute right-5 top-5 text-[10px] text-ink-dim">
                Step {i + 1} / 2
              </span>

              {/* Header */}
              <div className="flex items-start gap-3">
                <PayeeAvatar kind={s.key} />
                <div>
                  <div className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                    {s.title}
                  </div>
                  <p className="mt-0.5 max-w-[34ch] text-sm leading-relaxed text-ink-dim">
                    {s.subtitle}
                  </p>
                </div>
              </div>

              {/* Payment route */}
              <div className="mt-5 flex items-center justify-between gap-2 rounded-md border border-border bg-bg-neutral px-4 py-3 font-mono text-[13px]">
                <span className="flex items-center gap-1.5 text-ink-dim">
                  <Bot className="h-4 w-4 text-accent" /> your agent
                </span>
                <span className="flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-ink-dim" />
                  <span className="text-ink">{s.amount} USDC</span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-dim" />
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    s.key === "scammer" ? "text-deny" : "text-allow"
                  )}
                >
                  {s.payeeLabel} #{s.payeeAgentId.toString()}
                </span>
              </div>

              {/* Live reputation read */}
              <div className="mt-4">
                <div className="mono-label mb-2 text-[10px] text-ink-dim">
                  Payee reputation · ERC-8004 (avg over trusted attestors)
                </div>
                {st.status === "running" ? (
                  <div className="relative h-[72px] overflow-hidden rounded-md border border-border bg-bg-neutral">
                    <div className="absolute inset-x-0 h-9 animate-scan bg-gradient-to-b from-accent/20 to-transparent" />
                    <div className="flex h-full items-center justify-center gap-2 font-mono text-xs text-ink-dim">
                      <Loader2 className="h-4 w-4 animate-spin" /> reading on-chain
                      reputation…
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <RepStat label="Ratings" value={rep ? rep.count : "—"} />
                    <RepStat
                      label="Average"
                      value={avg === null ? "—" : avg.toFixed(0)}
                      tone={rep ? repTone : "neutral"}
                    />
                    <RepStat
                      label="Threshold"
                      value="≥ 70"
                      tone="neutral"
                    />
                  </div>
                )}
              </div>

              {/* Verdict */}
              <div className="mt-4">
                {st.status === "idle" && (
                  <Button
                    variant="subtle"
                    className="w-full"
                    onClick={() => runScenario(s)}
                  >
                    Ask the gate
                  </Button>
                )}
                {st.status === "done" && st.result && (
                  <div className="space-y-3">
                    <VerdictPanel
                      decision={st.result.decision}
                      reason={st.result.reason}
                      source={st.result.source}
                    />
                    <p className="text-sm leading-relaxed text-ink-dim">
                      <span className="font-medium text-ink">Why: </span>
                      {s.why}
                    </p>
                  </div>
                )}
                {st.status === "error" && (
                  <div className="rounded-md border border-deny/30 bg-[rgba(193,59,38,0.06)] px-4 py-3 text-sm text-deny">
                    {st.error}
                  </div>
                )}
              </div>

              {/* Footer: contract link */}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 font-mono text-[11px] text-ink-dim">
                <span>Gate read against PolicyVault</span>
                {VAULT && (
                  <a
                    href={explorerAddress(VAULT)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-monad-700 hover:underline"
                  >
                    {shortAddr(VAULT, 6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
