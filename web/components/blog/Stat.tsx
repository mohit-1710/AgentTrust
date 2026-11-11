import type { ReactNode } from "react";

import styles from "@/components/blog/Stat.module.css";

interface StatProps {
  readonly number: string;
  readonly unit?: string;
  readonly label: string;
}

export function Stat({ number, unit, label }: StatProps) {
  return (
    <div className={styles.item}>
      <span className={styles.number}>
        {number}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      <p className={styles.label}>{label}</p>
    </div>
  );
}

interface StatGridProps {
  readonly children: ReactNode;
}

export function StatGrid({ children }: StatGridProps) {
  return <div className={styles.grid}>{children}</div>;
}
