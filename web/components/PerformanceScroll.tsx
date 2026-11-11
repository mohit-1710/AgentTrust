"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import PerformanceBars from "@/components/PerformanceBars";
import PerformanceRadar from "@/components/PerformanceRadar";
import PerformanceStats from "@/components/PerformanceStats";
import PillLink from "@/components/ui/PillLink";
import styles from "@/components/PerformanceScroll.module.css";
import { PERFORMANCE_CTA, PERFORMANCE_STATEMENT } from "@/data/performance";
import { createPerformanceScrollAnimation } from "@/lib/animations/performanceScroll";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function PerformanceScroll() {
  const isReducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createPerformanceScrollAnimation({
        isReducedMotion,
        root,
      });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.pinArea} ref={rootRef}>
      <div className={styles.stage}>
        <div className={styles.dots} aria-hidden="true" />
        <div className={styles.content}>
          <p className={styles.eyebrow} data-performance-reveal>
            / Unparalleled performance
          </p>
          <p className={styles.statement} data-performance-reveal>
            {PERFORMANCE_STATEMENT}
          </p>
          <div data-performance-reveal>
            <PerformanceStats />
          </div>
          <div data-performance-reveal>
            <PillLink
              href={PERFORMANCE_CTA.href}
              icon="file"
              variant="secondary"
            >
              {PERFORMANCE_CTA.label}
            </PillLink>
          </div>
        </div>
        <PerformanceRadar />
        <PerformanceBars />
      </div>
    </div>
  );
}
