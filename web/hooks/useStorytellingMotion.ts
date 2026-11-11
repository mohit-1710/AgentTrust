"use client";

import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { STORYTELLING_PANELS } from "@/data/storytelling";
import { createPointerParallax } from "@/lib/animations/pointerParallax";
import { createStorytellingScrollTrigger } from "@/lib/animations/storytellingScroll";

interface UseStorytellingMotionConfig {
  readonly onActiveIndexChange: (index: number) => void;
  readonly rootRef: RefObject<HTMLElement | null>;
  readonly shouldReduceMotion: boolean;
}

function createNoopCleanup(): () => void {
  return () => undefined;
}

export function useStorytellingMotion({
  onActiveIndexChange,
  rootRef,
  shouldReduceMotion,
}: UseStorytellingMotionConfig): void {
  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root || shouldReduceMotion) {
        return;
      }

      const media = gsap.matchMedia();

      media.add("(min-width: 940px)", () => {
        const graphics = root.querySelector<HTMLElement>("[data-story-graphics]");
        const cleanupScroll = createStorytellingScrollTrigger({
          count: STORYTELLING_PANELS.length,
          root,
          onActiveIndexChange,
        });
        const cleanupPanelParallax = graphics
          ? createPointerParallax({
              duration: 0.96,
              maxRotation: 0.18,
              maxX: 8,
              maxY: 5,
              root: graphics,
              targetSelector: "[data-story-motion-layer]",
            })
          : createNoopCleanup();
        const cleanupDiagramParallax = graphics
          ? createPointerParallax({
              duration: 0.88,
              maxRotation: 0.46,
              maxX: 24,
              maxY: 16,
              root: graphics,
              targetSelector: "[data-story-diagram-layer]",
            })
          : createNoopCleanup();

        return () => {
          cleanupDiagramParallax();
          cleanupPanelParallax();
          cleanupScroll();
        };
      });

      return () => media.revert();
    },
    { dependencies: [shouldReduceMotion], scope: rootRef },
  );
}
