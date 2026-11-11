"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import styles from "@/components/BenchmarkSection.module.css";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createBenchmarkMotion } from "@/lib/animations/benchmarkMotion";

const CORNER_KEYS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

interface BenchmarkStatementProps {
  readonly lines: readonly string[];
  readonly title: string;
}

export default function BenchmarkStatement({
  lines,
  title,
}: BenchmarkStatementProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createBenchmarkMotion({ isReducedMotion, root });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.statement} ref={rootRef}>
      {CORNER_KEYS.map((corner) => (
        <span
          aria-hidden="true"
          className={`${styles.corner} ${styles[corner]}`}
          data-benchmark-corner
          key={corner}
        />
      ))}
      <h2
        id="benchmark-title"
        className={styles.heading}
        aria-label={title}
        data-benchmark-heading
      >
        {lines.map((line) => (
          <span className={styles.headingMask} key={line}>
            <span className={styles.headingLine} data-benchmark-line>
              {line}
            </span>
          </span>
        ))}
      </h2>
    </div>
  );
}
