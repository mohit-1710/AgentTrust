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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  parseClients,
  readReputation,
  trustVerdict,
  type ReputationResult,
} from "@/lib/reputation";
import { TRUSTED_ATTESTOR } from "@/lib/demo";
import { REPUTATION_REGISTRY } from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { cn, shortAddr } from "@/lib/utils";
import { Loader2, ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink } from "lucide-react";

const toneIcon = { good: ShieldCheck, bad: ShieldAlert, warn: ShieldQuestion };
const toneClass = {
  good: "border-allow/30 bg-[rgba(31,122,61,0.06)] text-allow",
  bad: "border-deny/30 bg-[rgba(193,59,38,0.06)] text-deny",
  warn: "border-warn/30 bg-[rgba(176,125,18,0.07)] text-warn",
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel-soft rounded-md p-4">
      <div className="mono-label text-[10px] text-ink-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
        {value}
      </div>
    </div>
  );
}

export function ReputationPanel() {
  const [agentId, setAgentId] = React.useState("1763");
  const [clientsRaw, setClientsRaw] = React.useState<string>(TRUSTED_ATTESTOR);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ReputationResult | null>(null);

  async function check() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const clients = parseClients(clientsRaw);
      const id = BigInt(agentId.trim() || "0");
      const r = await readReputation(id, clients);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Read failed");
    } finally {
      setLoading(false);
    }
  }

  // Pre-load the default agent (1763) on mount so the presenter sees real
  // on-chain numbers immediately, before touching anything.
  React.useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verdict = result ? trustVerdict(result) : null;
  const Icon = verdict ? toneIcon[verdict.tone] : ShieldQuestion;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            Reputation lookup
          </CardTitle>
          <Badge variant="good">
            <span className="h-1.5 w-1.5 rounded-full bg-allow animate-pulse-soft" />
            Live
          </Badge>
        </div>
        <CardDescription>
          Reads ERC-8004{" "}
          <code className="font-mono text-monad-700">getSummary</code> straight
          from the registry on Monad testnet. The registry requires an explicit
          set of trusted attestors — Sybil-resistant by design.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="agentId">Agent ID</Label>
            <Input
              id="agentId"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="1"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clients">Trusted attestors (comma / newline)</Label>
            <Input
              id="clients"
              value={clientsRaw}
              onChange={(e) => setClientsRaw(e.target.value)}
              placeholder="0x…, 0x…"
            />
          </div>
        </div>

        <Button onClick={check} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Reading registry…
            </>
          ) : (
            "Read reputation"
          )}
        </Button>

        {error && (
          <div className="rounded-md border border-deny/30 bg-[rgba(193,59,38,0.06)] px-4 py-3 text-sm text-deny">
            {error}
          </div>
        )}

        {result && verdict && (
          <div className="space-y-4 animate-fade-up">
            <div
              className={cn(
                "flex items-center gap-3 rounded-md border p-4",
                toneClass[verdict.tone]
              )}
            >
              <Icon className="h-7 w-7 shrink-0" />
              <div>
                <div className="font-display text-base font-semibold tracking-[-0.01em] text-ink">
                  {verdict.verdict}
                </div>
                <div className="text-sm text-ink-dim">{verdict.label}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Ratings" value={result.count} />
              <Stat label="Total (sum)" value={result.total} />
              <Stat
                label="Average"
                value={result.average === null ? "—" : result.average.toFixed(0)}
              />
            </div>

            <div className="rounded-md border border-border bg-bg-neutral px-4 py-2 font-mono text-xs text-ink-dim">
              From {result.clients.length} trusted attestor
              {result.clients.length === 1 ? "" : "s"} · decimals{" "}
              {result.decimals} · registry{" "}
              <a
                href={explorerAddress(REPUTATION_REGISTRY)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-monad-700 hover:underline"
              >
                {shortAddr(REPUTATION_REGISTRY)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
