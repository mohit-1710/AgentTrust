"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import ExploreCard from "@/components/ExploreCard";
import styles from "@/components/ExploreSection.module.css";
import { EXPLORE_CARDS, EXPLORE_HEADING } from "@/data/explore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createExploreReveal } from "@/lib/animations/exploreReveal";

export default function ExploreContent() {
  const isReducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createExploreReveal({ isReducedMotion, root });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.content} ref={rootRef}>
      <h2 className={styles.heading}>
        <span className={styles.headingMask}>
          <span data-explore-heading>{EXPLORE_HEADING}</span>
        </span>
      </h2>
      <div className={styles.cards}>
        {EXPLORE_CARDS.map((card) => (
          <ExploreCard card={card} key={card.title} />
        ))}
      </div>
    </div>
  );
}
