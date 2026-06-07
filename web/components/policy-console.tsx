"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { VerdictPanel } from "./verdict-badge";
import {
  evaluatePolicy,
  decisionMeta,
  type PolicyConsoleConfig,
} from "@/lib/gate";
import { readReputation, type ReputationResult } from "@/lib/reputation";
import { TRUSTED_ATTESTOR } from "@/lib/demo";
import { REPUTATION_REGISTRY } from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { cn, shortAddr } from "@/lib/utils";
import { Loader2, SlidersHorizontal, Power, ExternalLink } from "lucide-react";

const DEFAULTS: PolicyConsoleConfig = {
  minReputation: 50,
  perTxCapUsdc: 10,
  dailyCapUsdc: 50,
  minFeedbackCount: 1,
  paused: false,
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-[12px]">{label}</Label>
        <span className="font-display text-lg font-semibold tabular-nums tracking-[-0.02em] text-ink">
          {value}
          {suffix && (
            <span className="ml-1 font-mono text-[11px] font-normal text-ink-dim">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="policy-range w-full"
        aria-label={label}
      />
    </div>
  );
}

export function PolicyConsole() {
  const [agentId, setAgentId] = React.useState("1763");
  const [attestor] = React.useState<string>(TRUSTED_ATTESTOR);
  const [amount, setAmount] = React.useState(5);
  const [cfg, setCfg] = React.useState<PolicyConsoleConfig>(DEFAULTS);

  const [rep, setRep] = React.useState<ReputationResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-read live on-chain reputation whenever the agent under inspection
  // changes (debounced). Policy edits are evaluated locally against this read.
  React.useEffect(() => {
    let alive = true;
    const id = agentId.trim();
    if (!id) {
      setRep(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await readReputation(BigInt(id), [
          attestor as `0x${string}`,
        ]);
        if (alive) setRep(r);
      } catch (e) {
        if (alive) {
          setRep(null);
          setError(e instanceof Error ? e.message : "read failed");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [agentId, attestor]);

  const decision = React.useMemo(
    () =>
      rep
        ? evaluatePolicy(cfg, amount, {
            count: rep.count,
            average: rep.average,
          })
        : null,
    [cfg, amount, rep]
  );

  const avg = rep?.average ?? null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-accent" />
            Your policy
          </CardTitle>
          <Badge variant="good">
            <span className="h-1.5 w-1.5 rounded-full bg-allow animate-pulse-soft" />
            Live on-chain reputation
          </Badge>
        </div>
        <CardDescription>
          Tune your agent&apos;s spending policy. Every change is re-evaluated
          instantly against the <span className="text-ink">live ERC-8004</span>{" "}
          reputation of the agent below — same decision logic as the on-chain
          gate. Slide the threshold up and watch a trusted agent flip to denied.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Counterparty under inspection */}
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="pc-agent">Counterparty agent ID</Label>
            <Input
              id="pc-agent"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              inputMode="numeric"
              placeholder="1763"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Live reputation (avg over your attestor)</Label>
            <div className="flex h-9 items-center gap-3 rounded-md border border-border bg-bg-neutral px-3 font-mono text-[13px]">
              {loading ? (
                <span className="flex items-center gap-2 text-ink-dim">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> reading
                  on-chain…
                </span>
              ) : error ? (
                <span className="text-deny">{error}</span>
              ) : rep ? (
                <>
                  <span className="text-ink-dim">
                    {rep.count} rating{rep.count === 1 ? "" : "s"}
                  </span>
                  <span className="text-border">·</span>
                  <span
                    className={cn(
                      "font-semibold",
                      avg === null
                        ? "text-ink-dim"
                        : avg >= cfg.minReputation
                          ? "text-allow"
                          : "text-deny"
                    )}
                  >
                    avg {avg === null ? "—" : avg}
                  </span>
                </>
              ) : (
                <span className="text-ink-dim">enter an agent id</span>
              )}
            </div>
          </div>
        </div>

        {/* Policy controls */}
        <div className="grid gap-6 rounded-[10px] border border-border bg-bg-neutral p-5 sm:grid-cols-2">
          <Slider
            label="Min counterparty reputation"
            value={cfg.minReputation}
            min={-100}
            max={100}
            step={5}
            onChange={(v) => setCfg((c) => ({ ...c, minReputation: v }))}
          />
          <Slider
            label="Payment amount"
            value={amount}
            min={1}
            max={100}
            step={1}
            suffix="USDC"
            onChange={setAmount}
          />
          <Slider
            label="Per-transaction cap"
            value={cfg.perTxCapUsdc}
            min={1}
            max={100}
            step={1}
            suffix="USDC"
            onChange={(v) => setCfg((c) => ({ ...c, perTxCapUsdc: v }))}
          />
          <Slider
            label="Daily cap"
            value={cfg.dailyCapUsdc}
            min={1}
            max={500}
            step={5}
            suffix="USDC"
            onChange={(v) => setCfg((c) => ({ ...c, dailyCapUsdc: v }))}
          />

          <button
            type="button"
            onClick={() => setCfg((c) => ({ ...c, paused: !c.paused }))}
            className={cn(
              "col-span-full flex items-center justify-between rounded-md border px-4 py-2.5 transition-colors",
              cfg.paused
                ? "border-deny/40 bg-[rgba(193,59,38,0.06)] text-deny"
                : "border-border bg-bg-elev text-ink-dim hover:text-ink"
            )}
          >
            <span className="flex items-center gap-2 font-mono text-[12px]">
              <Power className="h-4 w-4" />
              Killswitch
            </span>
            <span className="mono-label text-[10px]">
              {cfg.paused ? "PAUSED — all payments denied" : "Active"}
            </span>
          </button>
        </div>

        {/* Live verdict */}
        {decision && (
          <div className="space-y-3">
            <VerdictPanel
              decision={decision.decision}
              reason={decision.reason}
              source="preview"
            />
            <p className="text-sm leading-relaxed text-ink-dim">
              {decisionMeta[decision.decision].blurb}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4 font-mono text-[11px] text-ink-dim">
          <span>Decision logic mirrors PolicyVault.gate()</span>
          <a
            href={explorerAddress(REPUTATION_REGISTRY)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-monad-700 hover:underline"
          >
            registry {shortAddr(REPUTATION_REGISTRY, 4)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
