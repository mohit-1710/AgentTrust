"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import TrilemmaGlyph from "@/components/TrilemmaGlyph";
import styles from "@/components/TrilemmaSection.module.css";
import { TRILEMMA_COPY } from "@/data/trilemma";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createTrilemmaScrollAnimation } from "@/lib/animations/trilemmaScroll";

export default function TrilemmaScroll() {
  const isReducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createTrilemmaScrollAnimation({
        isReducedMotion,
        root,
      });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.pinArea} ref={rootRef}>
      <div className={styles.stage}>
        <div className={styles.background} aria-hidden="true" />
        <div className={styles.glyphLayer}>
          <TrilemmaGlyph />
        </div>
        <div className={styles.lead} data-trilemma-lead>
          <p className={styles.statement}>
            {TRILEMMA_COPY.leadLines.map((line) => (
              <span className={styles.lineMask} key={line}>
                <span data-trilemma-line>{line}</span>
              </span>
            ))}
          </p>
        </div>
        <div className={styles.resolve} data-trilemma-resolve>
          <p className={styles.statement}>
            {TRILEMMA_COPY.resolvePrefix}{" "}
            <em>{TRILEMMA_COPY.resolveEmphasis}</em>{" "}
            {TRILEMMA_COPY.resolveSuffix}
          </p>
        </div>
        <p
          className={styles.center}
          data-trilemma-center
          aria-label={TRILEMMA_COPY.center}
        >
          {TRILEMMA_COPY.centerLines.map((line) => (
            <span className={styles.centerLine} key={line}>
              {line}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
