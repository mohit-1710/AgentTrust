"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createHeroIntroTimeline } from "@/lib/animations/heroIntro";

interface HeroRevealProps {
  readonly children: ReactNode;
}

export default function HeroReveal({ children }: HeroRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root || shouldReduceMotion) {
        return;
      }

      const timeline = createHeroIntroTimeline(root);

      return () => {
        timeline.kill();
      };
    },
    { dependencies: [shouldReduceMotion], scope: rootRef },
  );

  return <div ref={rootRef}>{children}</div>;
}
