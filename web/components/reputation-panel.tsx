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
  good: "text-allow",
  bad: "text-deny",
  warn: "text-warn",
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function ReputationPanel() {
  const [agentId, setAgentId] = React.useState("1");
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

  const verdict = result ? trustVerdict(result) : null;
  const Icon = verdict ? toneIcon[verdict.tone] : ShieldQuestion;

  return (
    <Card className="glow-monad">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-monad-300" />
            On-chain Reputation
          </CardTitle>
          <Badge variant="good" className="font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-allow animate-pulse" />
            LIVE
          </Badge>
        </div>
        <CardDescription>
          Reads ERC-8004{" "}
          <code className="font-mono text-monad-200">getSummary</code> straight
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
          <div className="rounded-lg border border-deny/30 bg-deny/10 px-4 py-3 text-sm text-deny">
            {error}
          </div>
        )}

        {result && verdict && (
          <div className="space-y-4 animate-fade-up">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-background/40 p-4",
                toneClass[verdict.tone]
              )}
            >
              <Icon className="h-7 w-7 shrink-0" />
              <div>
                <div className="text-base font-semibold">{verdict.verdict}</div>
                <div className="text-sm text-muted-foreground">
                  {verdict.label}
                </div>
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

            <div className="rounded-lg border border-border bg-background/30 px-4 py-2 text-xs text-muted-foreground">
              From {result.clients.length} trusted attestor
              {result.clients.length === 1 ? "" : "s"} · decimals{" "}
              {result.decimals} · registry{" "}
              <a
                href={explorerAddress(REPUTATION_REGISTRY)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-monad-200 hover:underline"
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
