"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import MediaCard from "@/components/MediaCard";
import MediaHeader from "@/components/MediaHeader";
import styles from "@/components/MediaSection.module.css";
import { MEDIA_CARDS } from "@/data/media";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createMediaReveal } from "@/lib/animations/mediaReveal";

export default function MediaContent() {
  const isReducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createMediaReveal({ isReducedMotion, root });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.content} ref={rootRef}>
      <MediaHeader />
      <div className={styles.cardViewport}>
        <div className={styles.cardGrid}>
          {MEDIA_CARDS.map((card) => (
            <MediaCard card={card} key={card.title} />
          ))}
        </div>
      </div>
    </div>
  );
}
