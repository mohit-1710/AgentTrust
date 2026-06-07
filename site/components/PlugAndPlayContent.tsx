"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import styles from "@/components/PlugAndPlayContent.module.css";
import PillLink from "@/components/ui/PillLink";
import {
  PLUG_COPY,
  PLUG_CTA,
  PLUG_SECTION_TITLE,
} from "@/data/plugAndPlay";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createPlugAndPlayReveal } from "@/lib/animations/plugAndPlayReveal";

export default function PlugAndPlayContent() {
  const rootRef = useRef<HTMLDivElement>(null);
  const isReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createPlugAndPlayReveal({ isReducedMotion, root });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.content} ref={rootRef}>
      <div className={styles.headingFrame} data-plug-reveal>
        <span className={styles.rule} aria-hidden="true" />
        <h2 id="plug-and-play-title" className={styles.title}>
          {PLUG_SECTION_TITLE}
        </h2>
        <span
          className={`${styles.rule} ${styles.ruleRight}`}
          aria-hidden="true"
        />
      </div>
      <p className={styles.body} data-plug-reveal>
        {PLUG_COPY.map((segment) => (
          <span
            className={segment.isDim ? styles.dim : undefined}
            key={segment.text}
          >
            {segment.text}
          </span>
        ))}
      </p>
      <div className={styles.ctaWrap} data-plug-reveal>
        <PillLink href={PLUG_CTA.href} variant="secondary">
          {PLUG_CTA.label}
        </PillLink>
      </div>
    </div>
  );
}
