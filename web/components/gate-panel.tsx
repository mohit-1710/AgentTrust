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
import { VerdictPanel } from "./verdict-badge";
import {
  runGate,
  decisionMeta,
  DEFAULT_SAMPLE_POLICY,
  type GateResult,
} from "@/lib/gate";
import { parseClients } from "@/lib/reputation";
import { parseUsdc, formatUsdc } from "@/lib/utils";
import { POLICY_VAULT_ADDRESS } from "@/lib/contracts";
import { SAMPLE_PAYER, TRUSTED_ATTESTOR } from "@/lib/demo";
import { Loader2, Gauge } from "lucide-react";

export function GatePanel() {
  const [payer, setPayer] = React.useState<string>(SAMPLE_PAYER);
  const [agentId, setAgentId] = React.useState("1763");
  const [amount, setAmount] = React.useState("5");
  const [clientsRaw, setClientsRaw] = React.useState<string>(TRUSTED_ATTESTOR);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GateResult | null>(null);

  async function check() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const clients = parseClients(clientsRaw);
      const r = await runGate({
        payer: payer.trim() as `0x${string}`,
        payeeAgentId: BigInt(agentId.trim() || "0"),
        amount: parseUsdc(amount),
        clients,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gate call failed");
    } finally {
      setLoading(false);
    }
  }

  const p = DEFAULT_SAMPLE_POLICY;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-accent" />
            Gate check
          </CardTitle>
          <Badge variant={POLICY_VAULT_ADDRESS ? "good" : "warn"}>
            {POLICY_VAULT_ADDRESS ? "PolicyVault · on-chain" : "Preview mode"}
          </Badge>
        </div>
        <CardDescription>
          {POLICY_VAULT_ADDRESS
            ? "Calls PolicyVault.gate() on Monad testnet — Allow / Deny / Require-Validation."
            : "PolicyVault not yet deployed. Computing a preview from the live reputation read + a sample payer policy. Mirrors the contract exactly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="payer">Payer (your agent)</Label>
            <Input
              id="payer"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-agentId">Payee agent ID</Label>
            <Input
              id="g-agentId"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-clients">Trusted attestors</Label>
            <Input
              id="g-clients"
              value={clientsRaw}
              onChange={(e) => setClientsRaw(e.target.value)}
            />
          </div>
        </div>

        {!POLICY_VAULT_ADDRESS && (
          <div className="rounded-md border border-border bg-bg-neutral px-4 py-2.5 font-mono text-xs text-ink-dim">
            <span className="font-medium text-ink">Sample policy:</span>{" "}
            per-tx ≤ {formatUsdc(p.perTxCap)} USDC · daily ≤{" "}
            {formatUsdc(p.dailyCap)} USDC · min avg reputation ≥{" "}
            {p.minReputation} · min {p.minFeedbackCount} rating
          </div>
        )}

        <Button onClick={check} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Evaluating gate…
            </>
          ) : (
            "Run the gate"
          )}
        </Button>

        {error && (
          <div className="rounded-md border border-deny/30 bg-[rgba(193,59,38,0.06)] px-4 py-3 text-sm text-deny">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 animate-fade-up">
            <VerdictPanel
              decision={result.decision}
              reason={result.reason}
              source={result.source}
            />
            <p className="text-sm leading-relaxed text-ink-dim">
              {decisionMeta[result.decision].blurb}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
