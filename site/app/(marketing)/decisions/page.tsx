// Live PolicyVault decisions feed for Monad testnet.
// The owner will wire the on-chain event subscription (PolicyAllowed /
// PolicyDenied logs from PolicyVault) to the Monad RPC. The UI shell, table,
// and decision model are in place; the feed is currently a placeholder.
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const EXPLORER_URL = "https://testnet.monadexplorer.com";
const RPC_URL = "https://testnet-rpc.monad.xyz";
const POLICY_VAULT = "0x34b3bB1a99377128126201359749FE7614275E37";
const POLL_MS = 4000;
const KEEP_ROWS = 30;

const DENY_REASONS: Record<number, string> = {
  1: "KillSwitchEngaged",
  2: "SpendingPerTxExceeded",
  3: "SpendingDailyExceeded",
  4: "SpendingWeeklyExceeded",
  5: "VelocityWindowExceeded",
  6: "CounterpartyTierBelowMin",
  7: "CounterpartyRiskAboveMax",
  8: "CounterpartyConfidenceBelow",
  9: "AttestationMissing",
  10: "AttestationExpired",
  11: "AttestationRevoked",
  12: "AttestationAttestorRejected",
  13: "UnratedTreatmentDeny",
};

void DENY_REASONS;

type Decision = {
  sig: string;
  kind: "ALLOW" | "DENY";
  reason: string | null;
  payee: string;
  amount: bigint;
  blockTime: number | null;
};

function truncate(s: string, head = 4, tail = 4): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function timeAgo(blockTime: number | null, now: number): string {
  if (blockTime === null || now === 0) return "—";
  const diff = Math.max(0, Math.floor(now / 1000 - blockTime));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatAmount(amount: bigint): string {
  const usdc = Number(amount) / 1_000_000;
  if (!Number.isFinite(usdc)) return `${amount.toString()}`;
  if (usdc >= 1_000_000) return `${(usdc / 1_000_000).toFixed(2)}M USDC`;
  if (usdc >= 1_000) return `${(usdc / 1_000).toFixed(2)}K USDC`;
  return `${usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}

void formatAmount;

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [errorMsg] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Placeholder: keeps the live shell active. Wire PolicyVault decision logs
    // from the Monad RPC here to populate the feed.
    void RPC_URL;
    void seenRef;
    void KEEP_ROWS;
    void setDecisions;
    const interval = setInterval(() => {
      setStatus("connecting");
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Live · Monad testnet</p>
        <h1 className={styles.title}>Decisions</h1>
        <p className={styles.subtitle}>
          Every <code className={styles.code}>gate_payment</code> decision PolicyVault emits, as it
          lands on-chain. ALLOW or DENY with reason, counterparty, amount, settlement signature.
        </p>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <span
              className={`${styles.dot} ${
                status === "live"
                  ? styles.dotLive
                  : status === "error"
                    ? styles.dotError
                    : styles.dotIdle
              }`}
            />
            <span className={styles.metaLabel}>
              {status === "live" ? "LIVE" : status === "error" ? "RPC ERROR" : "CONNECTING"}
            </span>
          </span>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>PolicyVault</span>
            <a
              className={styles.metaValue}
              href={`${EXPLORER_URL}/address/${POLICY_VAULT}`}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(POLICY_VAULT, 4, 4)}
            </a>
          </span>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Poll</span>
            <span className={styles.metaValue}>{POLL_MS / 1000}s</span>
          </span>
        </div>
      </header>

      <section className={styles.table} aria-label="Recent on-chain decisions">
        <div className={styles.tableHead}>
          <span>Decision</span>
          <span>Counterparty</span>
          <span>Amount</span>
          <span>Tx</span>
          <span>When</span>
        </div>
        {decisions.length === 0 && status !== "error" && (
          <div className={styles.empty}>
            Waiting for the next <code className={styles.code}>gate_payment</code> on testnet…
          </div>
        )}
        {decisions.length === 0 && status === "error" && (
          <div className={styles.empty}>RPC error: {errorMsg ?? "unknown"}. Retrying.</div>
        )}
        {decisions.map((d) => (
          <article key={d.sig} className={styles.row}>
            <span className={d.kind === "ALLOW" ? styles.allow : styles.deny}>
              <span className={styles.badge}>{d.kind}</span>
              {d.reason && <span className={styles.reason}>{d.reason}</span>}
            </span>
            <a
              className={styles.mono}
              href={`${EXPLORER_URL}/address/${d.payee}`}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(d.payee, 4, 4)}
            </a>
            <span className={styles.amount}>{formatAmount(d.amount)}</span>
            <a
              className={styles.mono}
              href={`${EXPLORER_URL}/tx/${d.sig}`}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(d.sig, 6, 6)}
            </a>
            <span className={styles.when}>{timeAgo(d.blockTime, now)}</span>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>
          Source: PolicyVault decision logs on Monad testnet, polled every {POLL_MS / 1000}s. Logs
          parsed for <code className={styles.code}>PolicyAllowed</code> /{" "}
          <code className={styles.code}>PolicyDenied</code> events. No backend.
        </p>
      </footer>
    </main>
  );
}
