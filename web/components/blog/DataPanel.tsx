import type { ReactNode } from "react";

import styles from "@/components/blog/DataPanel.module.css";

interface DataPanelProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function DataPanel({ label, children }: DataPanelProps) {
  return (
    <section className={styles.panel} aria-label={label}>
      <span className={styles.label}>{label}</span>
      {children}
    </section>
  );
}

interface DataRowProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function DataRow({ label, children }: DataRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  );
}
