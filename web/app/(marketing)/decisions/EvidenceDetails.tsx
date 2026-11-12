import type { EvidenceDetail } from "@/lib/near/evidence";
import styles from "./page.module.css";

export function EvidenceDetails({ detail }: { detail: EvidenceDetail }) {
  return (
    <details className={styles.evidence}>
      <summary>Inspect evidence</summary>
      <p className={styles.evidenceNote}>{detail.note}</p>
      <dl className={styles.evidenceFields}>
        {detail.fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.href ? <a href={field.href} target="_blank" rel="noreferrer">{field.value}</a> : field.value}</dd>
          </div>
        ))}
      </dl>
      <details className={styles.evidenceJson}>
        <summary>Public evidence JSON</summary>
        <pre>{detail.json}</pre>
      </details>
    </details>
  );
}
