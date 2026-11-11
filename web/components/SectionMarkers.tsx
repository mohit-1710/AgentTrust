"use client";

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import styles from "@/components/SectionMarkers.module.css";
import { SECTION_MARKERS } from "@/data/sections";
import { createSectionMarkerTriggers } from "@/lib/animations/sectionMarkers";

interface MarkerStyle extends CSSProperties {
  "--marker-index": number;
}

export default function SectionMarkers() {
  const rootRef = useRef<HTMLElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(
    () => {
      return createSectionMarkerTriggers({
        markers: SECTION_MARKERS,
        onActiveIndexChange: (nextIndex) => {
          if (nextIndex === activeIndexRef.current) {
            return;
          }

          activeIndexRef.current = nextIndex;
          setActiveIndex(nextIndex);
        },
      });
    },
    { scope: rootRef },
  );

  return (
    <nav
      ref={rootRef}
      aria-label="Section progress"
      className={styles.markers}
    >
      <ol className={styles.list}>
        {SECTION_MARKERS.map((marker, index) => {
          const markerStyle: MarkerStyle = { "--marker-index": index };
          const isActive = index === activeIndex;

          return (
            <li
              key={marker.href}
              className={
                isActive ? `${styles.item} ${styles.active}` : styles.item
              }
              style={markerStyle}
            >
              <a
                href={marker.href}
                className={styles.link}
                aria-label={`Navigate to ${marker.label} section`}
                aria-current={isActive ? "location" : undefined}
              >
                <span className={styles.label}>{marker.label}</span>
                <span className={styles.tick} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
