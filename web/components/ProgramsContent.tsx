"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import styles from "@/components/ProgramsSection.module.css";
import {
  DEVNET_PROGRAMS,
  PROGRAMS_EYEBROW,
  PROGRAMS_INTRO,
  PROGRAMS_TITLE,
} from "@/data/programs";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createProgramsReveal } from "@/lib/animations/programsReveal";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function explorerHref(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

export default function ProgramsContent() {
  const rootRef = useRef<HTMLDivElement>(null);
  const isReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createProgramsReveal({ isReducedMotion, root });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.frame} ref={rootRef}>
      <header className={styles.header}>
        <p className={styles.eyebrow} data-programs-fade>
          <span className={styles.slash} aria-hidden="true">
            /
          </span>
          {PROGRAMS_EYEBROW}
        </p>
        <h2 id="programs-title" className={styles.title} data-programs-fade>
          {PROGRAMS_TITLE.lead} <em>{PROGRAMS_TITLE.emphasis}</em>
        </h2>
        <p className={styles.intro} data-programs-fade>
          {PROGRAMS_INTRO}
        </p>
      </header>

      <ol className={styles.grid}>
        {DEVNET_PROGRAMS.map((program, index) => {
          const explorer = explorerHref(program.address);

          return (
            <li className={styles.card} key={program.name} data-programs-card>
              <span className={styles.index}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <a
                className={styles.name}
                href={program.docsHref}
                aria-label={`${program.name} documentation`}
                {...getExternalLinkAttributes(program.docsHref)}
              >
                {program.name}
              </a>
              <p className={styles.role}>{program.role}</p>
              <a
                className={styles.address}
                href={explorer}
                aria-label={`View ${program.name} on Solana Explorer (devnet)`}
                {...getExternalLinkAttributes(explorer)}
              >
                <span className={styles.addressLabel}>Program ID</span>
                <span className={styles.addressRow}>
                  <span className={styles.addressValue}>
                    {truncateAddress(program.address)}
                  </span>
                  <span className={styles.addressArrow} aria-hidden="true">
                    ↗
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      <div className={styles.connector} aria-hidden="true">
        <svg
          className={styles.connectorSvg}
          viewBox="0 0 600 162"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            className={styles.connectorPath}
            data-programs-draw
            d="M120 28 C120 96 300 84 300 142"
          />
          <path
            className={styles.connectorPath}
            data-programs-draw
            d="M300 28 L300 142"
          />
          <path
            className={styles.connectorPath}
            data-programs-draw
            d="M480 28 C480 96 300 84 300 142"
          />
          <circle
            className={styles.connectorNode}
            data-programs-node
            cx="120"
            cy="28"
            r="4.5"
          />
          <circle
            className={styles.connectorNode}
            data-programs-node
            cx="300"
            cy="28"
            r="4.5"
          />
          <circle
            className={styles.connectorNode}
            data-programs-node
            cx="480"
            cy="28"
            r="4.5"
          />
          <circle
            className={styles.connectorMerge}
            data-programs-node
            cx="300"
            cy="142"
            r="7.5"
          />
        </svg>
        <span className={styles.connectorCaption} data-programs-fade>
          gate_payment
        </span>
      </div>
    </div>
  );
}
