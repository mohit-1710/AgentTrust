"use client";

import { useEffect, useState } from "react";
import { accountUrl, formatNear, paymentLabel, transactionUrl } from "@/lib/near/format";
import type { DecisionsResponse } from "@/lib/near/types";
import styles from "./page.module.css";

const POLL_MS = 4000;
const ERROR_TEXT = {
  INVALID_CONFIGURATION: "This view's connection is not configured correctly.",
  INVALID_QUERY: "This payment page could not be requested.",
  DOMAIN_MISMATCH: "The configured network or contract does not match NEAR testnet.",
  RPC_UNAVAILABLE: "The latest final contract state could not be read. Retrying.",
};
function truncate(value: string, head = 10, tail = 6) {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}
function timeAgo(timestampNs: string, now: number): string {
  if (!now) return "—";
  const diff = Math.max(0, Math.floor(now / 1000) - Number(BigInt(timestampNs) / BigInt(1_000_000_000)));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DecisionsPage() {
  const [response, setResponse] = useState<DecisionsResponse | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const data = response?.kind === "ready" ? response : null;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    async function tick() {
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 30_000);
      try {
        const path = cursor === null ? "/api/decisions" : `/api/decisions?cursor=${encodeURIComponent(cursor)}`;
        const fetched = await fetch(path, { cache: "no-store", signal: request.signal });
        const body: DecisionsResponse = await fetched.json();
        if (!cancelled) { setResponse(body); setNow(Date.now()); }
      } catch {
        if (!cancelled) setResponse({ kind: "error", code: "RPC_UNAVAILABLE" });
      } finally {
        clearTimeout(timeout);
        // Schedule after completion, so a slow RPC never creates overlapping polls.
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    }
    void tick();
    return () => { cancelled = true; clearTimeout(timer); request?.abort(); };
  }, [cursor]);

  function showPage(next: string | null) { setResponse(null); setCursor(next); }
  const status = data ? "FINAL VIEWS" : response?.kind === "error" ? "UNAVAILABLE" : response?.kind === "unconfigured" ? "NOT CONNECTED" : "CONNECTING";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>NEAR testnet · Read-only</p>
        <h1 className={styles.title}>Decisions</h1>
        <p className={styles.subtitle}>
          Final contract views show dispatched payments and their current settlement state.
          Configured transaction references show rejected calls. A pending payment is still unresolved.
        </p>
        <div className={styles.meta}>
          <span className={styles.metaItem} role="status" aria-live="polite">
            <span className={`${styles.dot} ${data ? styles.dotLive : response?.kind === "error" ? styles.dotError : styles.dotIdle}`} />
            <span className={styles.metaLabel}>{status}</span>
          </span>
          {data && <>
            <span className={styles.metaItem}>
              <span className={styles.metaLabel}>Core</span>
              <a className={styles.metaValue} href={accountUrl(data.core_account)} target="_blank" rel="noreferrer" title={data.core_account}>
                {truncate(data.core_account)}
              </a>
            </span>
            <span className={styles.metaItem}>
              <span className={styles.metaLabel}>Owner</span>
              <a className={styles.metaValue} href={accountUrl(data.owner_id)} target="_blank" rel="noreferrer" title={data.owner_id}>
                {truncate(data.owner_id)}
              </a>
            </span>
          </>}
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Poll</span>
            <span className={styles.metaValue}>{POLL_MS / 1000}s after each read</span>
          </span>
        </div>
      </header>

      <section className={styles.table} aria-label="NEAR payment states and configured rejected calls">
        <div className={styles.tableHead}>
          <span>State</span><span>Supplier / payout</span><span>Amount</span><span>Evidence</span><span>Dispatched</span>
        </div>
        {!response && <div className={styles.empty}>Connecting to final NEAR contract views…</div>}
        {response?.kind === "unconfigured" && <div className={styles.empty}>
          Live data is not connected. No contract and owner are configured for this view.
        </div>}
        {response?.kind === "error" && <div className={styles.empty} role="alert">{ERROR_TEXT[response.code]}</div>}
        {data && data.page.items.length === 0 && data.rejections.length === 0 && <div className={styles.empty}>
          No dispatched payments on this page. This does not establish whether an unknown submission can still execute.
        </div>}
        {data?.page.items.map((payment) => (
          <article key={payment.invoice.payment_id} className={styles.row}>
            <span className={payment.state === "settled" ? styles.allow : payment.state === "failed" ? styles.deny : styles.pending}>
              <span className={styles.badge}>{paymentLabel(payment)}</span>
              <span className={styles.reason}>{payment.display_state === "needs_reconciliation" ? "Reserved; no automatic refund" : "Final contract view"}</span>
            </span>
            <span className={styles.counterparty}>
              <a className={styles.mono} href={accountUrl(payment.invoice.service_id)} target="_blank" rel="noreferrer" title={payment.invoice.service_id}>
                {truncate(payment.invoice.service_id)} <small>v{payment.invoice.service_version}</small>
              </a>
              <a className={styles.reason} href={accountUrl(payment.invoice.payout_account)} target="_blank" rel="noreferrer" title={`Payout: ${payment.invoice.payout_account}`}>
                {truncate(payment.invoice.payout_account)}
              </a>
            </span>
            <span className={styles.amount}>{formatNear(payment.invoice.amount_yocto)}</span>
            <span className={styles.counterparty} title={`Payment ID: ${payment.invoice.payment_id}`}>
              <span className={styles.mono}>{truncate(payment.invoice.payment_id, 6, 6)}</span>
              <span className={styles.reason}>Payment ID · no tx supplied</span>
            </span>
            <span className={styles.when} title={new Date(Number(BigInt(payment.dispatched_at_ns) / BigInt(1_000_000))).toISOString()}>
              {timeAgo(payment.dispatched_at_ns, now)}
            </span>
          </article>
        ))}
        {data?.rejections.map((rejection) => (
          <article key={rejection.transaction.tx_hash} className={styles.row}>
            <span className={styles.deny}>
              <span className={styles.badge}>REJECTED CALL</span>
              <span className={styles.reason}>{rejection.decision.kind === "require_validation" ? "Credential: " : ""}{rejection.decision.code}</span>
            </span>
            <a className={styles.mono} href={accountUrl(rejection.invoice.service_id)} target="_blank" rel="noreferrer" title={rejection.invoice.service_id}>
              {truncate(rejection.invoice.service_id)} <small>v{rejection.invoice.service_version}</small>
            </a>
            <span className={styles.amount}>{formatNear(rejection.invoice.amount_yocto)}</span>
            <a className={styles.mono} href={transactionUrl(rejection.transaction.tx_hash)} target="_blank" rel="noreferrer" title={rejection.transaction.tx_hash}>
              {truncate(rejection.transaction.tx_hash, 6, 6)}
            </a>
            <span className={styles.when}>Not dispatched by this call</span>
          </article>
        ))}
      </section>

      {data && <nav className={styles.pagination} aria-label="Payment pages">
        <button type="button" className={styles.pageButton} disabled={cursor === null} onClick={() => showPage(null)}>Latest payments</button>
        <button type="button" className={styles.pageButton} disabled={data.page.next_cursor === null} onClick={() => showPage(data.page.next_cursor)}>Older payments</button>
      </nav>}

      <footer className={styles.footer}>
        <p>
          Source: <code className={styles.code}>list_recent_payments</code> at finality <code className={styles.code}>final</code>,
          20 records per page. Rejected calls appear only for configured transaction references with a verified final core response;
          this is not a complete denial history. Previews have no transaction receipt. RPC observations are not light-client proofs.
        </p>
        {data && <p>Last successful read: <time dateTime={data.observed_at}>{new Date(data.observed_at).toUTCString()}</time>.</p>}
        {!!data?.unresolved_references && <p role="status">{data.unresolved_references} configured transaction reference(s) could not be established as final rejected calls.</p>}
      </footer>
    </main>
  );
}
