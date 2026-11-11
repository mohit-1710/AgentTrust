// Approach A (pure client-side). Polls Solana devnet RPC every 4s via fetch,
// scans tx logs for Anchor PolicyAllowed / PolicyDenied events emitted by
// PolicyVault (CPI'd from TrustGate). No backend, no extra deps.
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const RPC_URL = "https://api.devnet.solana.com";
const POLICY_VAULT = "8Y6fGeNEHgmWmbt8JsRcF72jxbeBfJhomMjG6SuoJQTR";
const POLL_MS = 4000;
const FETCH_LIMIT = 25;
const KEEP_ROWS = 30;

const DISC_ALLOWED = [240, 34, 117, 111, 248, 141, 198, 213];
const DISC_DENIED = [18, 131, 136, 241, 88, 193, 230, 24];

const DENY_REASONS: Record<number, string> = {
  1: "KillSwitchEngaged",
  2: "SpendingPerTxExceeded",
  3: "SpendingDailyExceeded",
  4: "SpendingWeeklyExceeded",
  5: "VelocityWindowExceeded",
  6: "CounterpartyTierBelowMin",
  7: "CounterpartyRiskAboveMax",
  8: "CounterpartyConfidenceBelow",
  9: "AtomStatsWrongOwner",
  10: "AtomStatsSchemaMismatch",
  11: "AttestationMissing",
  12: "AttestationExpired",
  13: "AttestationRevoked",
  14: "AttestationAttestorRejected",
  15: "UnratedTreatmentDeny",
};

type Decision = {
  sig: string;
  kind: "ALLOW" | "DENY";
  reason: string | null;
  payee: string;
  amount: bigint;
  blockTime: number | null;
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let i = 0; i < zeros; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return dv.getBigUint64(0, true);
}

function discMatches(bytes: Uint8Array, disc: number[]): boolean {
  if (bytes.length < disc.length) return false;
  for (let i = 0; i < disc.length; i++) if (bytes[i] !== disc[i]) return false;
  return true;
}

function parseDecisionFromLogs(logs: string[], sig: string, blockTime: number | null): Decision | null {
  for (const line of logs) {
    if (!line.startsWith("Program data: ")) continue;
    const b64 = line.slice("Program data: ".length).trim();
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64ToBytes(b64);
    } catch {
      continue;
    }
    if (discMatches(bytes, DISC_ALLOWED)) {
      // 8 disc + 32 payer + 32 payee + 8 amount + 4 policy_id + 8 slot
      if (bytes.length < 92) continue;
      const payee = bytes.slice(8 + 32, 8 + 32 + 32);
      const amount = readU64LE(bytes, 8 + 64);
      return {
        sig,
        kind: "ALLOW",
        reason: null,
        payee: encodeBase58(payee),
        amount,
        blockTime,
      };
    }
    if (discMatches(bytes, DISC_DENIED)) {
      // 8 disc + 32 payer + 32 payee + 8 amount + 4 policy_id + 1 reason + 8 slot
      if (bytes.length < 93) continue;
      const payee = bytes.slice(8 + 32, 8 + 32 + 32);
      const amount = readU64LE(bytes, 8 + 64);
      const reasonByte = bytes[8 + 64 + 8 + 4];
      return {
        sig,
        kind: "DENY",
        reason: DENY_REASONS[reasonByte] ?? `reason ${reasonByte}`,
        payee: encodeBase58(payee),
        amount,
        blockTime,
      };
    }
  }
  return null;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${method} ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
  return j.result as T;
}

type SigInfo = { signature: string; blockTime: number | null; err: unknown };
type TxResult = { meta: { logMessages: string[] | null } | null } | null;

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

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const sigs = await rpc<SigInfo[]>("getSignaturesForAddress", [
          POLICY_VAULT,
          { limit: FETCH_LIMIT },
        ]);
        if (cancelled) return;

        const fresh = sigs.filter((s) => !seenRef.current.has(s.signature) && !s.err);
        const ordered = [...fresh].reverse();
        const newDecisions: Decision[] = [];
        for (const s of ordered) {
          seenRef.current.add(s.signature);
          const tx = await rpc<TxResult>("getTransaction", [
            s.signature,
            { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
          ]);
          if (cancelled) return;
          const logs = tx?.meta?.logMessages ?? null;
          if (!logs) continue;
          const decision = parseDecisionFromLogs(logs, s.signature, s.blockTime);
          if (decision) newDecisions.push(decision);
        }

        if (newDecisions.length > 0) {
          setDecisions((prev) => {
            const merged = [...newDecisions.reverse(), ...prev];
            const dedup: Decision[] = [];
            const seen = new Set<string>();
            for (const d of merged) {
              if (seen.has(d.sig)) continue;
              seen.add(d.sig);
              dedup.push(d);
              if (dedup.length >= KEEP_ROWS) break;
            }
            return dedup;
          });
        }
        setStatus("live");
        setErrorMsg(null);
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(e instanceof Error ? e.message : "unknown error");
        }
      }
    }

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Live · Solana devnet</p>
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
              href={`https://explorer.solana.com/address/${POLICY_VAULT}?cluster=devnet`}
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
            Waiting for the next <code className={styles.code}>gate_payment</code> on devnet…
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
              href={`https://explorer.solana.com/address/${d.payee}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(d.payee, 4, 4)}
            </a>
            <span className={styles.amount}>{formatAmount(d.amount)}</span>
            <a
              className={styles.mono}
              href={`https://explorer.solana.com/tx/${d.sig}?cluster=devnet`}
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
          Source: <code className={styles.code}>getSignaturesForAddress</code> against PolicyVault on
          devnet, polled every {POLL_MS / 1000}s. Logs parsed for Anchor <code className={styles.code}>PolicyAllowed</code> /{" "}
          <code className={styles.code}>PolicyDenied</code> events. No backend.
        </p>
      </footer>
    </main>
  );
}
