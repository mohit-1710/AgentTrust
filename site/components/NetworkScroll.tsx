"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import NetworkGlobe from "@/components/NetworkGlobe";
import NetworkSignalRail from "@/components/NetworkSignalRail";
import styles from "@/components/NetworkScroll.module.css";
import PillLink from "@/components/ui/PillLink";
import { NETWORK_COPY, NETWORK_CTA } from "@/data/network";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createNetworkReveal } from "@/lib/animations/networkReveal";

export default function NetworkScroll() {
  const rootRef = useRef<HTMLDivElement>(null);
  const isReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      return createNetworkReveal({ isReducedMotion, root });
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div className={styles.pinArea} data-network-pin ref={rootRef}>
      <div className={styles.stage}>
        <div className={styles.copy}>
          <p className={styles.body} data-network-reveal>
            {NETWORK_COPY.map((segment) => (
              <span
                className={segment.isDim ? styles.dim : undefined}
                key={segment.text}
              >
                {segment.text}
              </span>
            ))}
          </p>
          <div className={styles.ctaWrap} data-network-reveal>
            <PillLink href={NETWORK_CTA.href} variant="secondary">
              {NETWORK_CTA.label}
            </PillLink>
          </div>
        </div>
        <div className={styles.visual}>
          <NetworkGlobe />
        </div>
        <NetworkSignalRail />
      </div>
    </div>
  );
}
