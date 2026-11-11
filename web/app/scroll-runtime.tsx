"use client";

import type { ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SCROLL_RUNTIME } from "@/data/scroll";
import { easeOutExpo } from "@/lib/scrollEasing";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

interface ScrollRuntimeProps {
  readonly children: ReactNode;
}

export function ScrollRuntime({ children }: ScrollRuntimeProps) {
  useGSAP(() => {
    let lenis: Lenis | null = null;
    let removeLenisScroll: (() => void) | null = null;
    let tickLenis: ((timeSeconds: number) => void) | null = null;

    ScrollTrigger.defaults({
      scroller: window,
      invalidateOnRefresh: true,
    });

    const refresh = () => {
      lenis?.resize();
      ScrollTrigger.refresh();
    };

    const shouldUseNativeScroll =
      window.matchMedia(REDUCED_MOTION_QUERY).matches ||
      window.matchMedia(COARSE_POINTER_QUERY).matches;

    if (!shouldUseNativeScroll) {
      lenis = new Lenis({
        anchors: {
          duration: SCROLL_RUNTIME.anchorDurationSeconds,
          easing: easeOutExpo,
          offset: SCROLL_RUNTIME.anchorOffset,
        },
        duration: SCROLL_RUNTIME.durationSeconds,
        easing: easeOutExpo,
        smoothWheel: true,
        stopInertiaOnNavigate: true,
        touchMultiplier: SCROLL_RUNTIME.touchMultiplier,
        wheelMultiplier: SCROLL_RUNTIME.wheelMultiplier,
      });

      removeLenisScroll = lenis.on("scroll", () => {
        ScrollTrigger.update();
      });

      tickLenis = (timeSeconds: number) => {
        lenis?.raf(timeSeconds * 1000);
      };

      gsap.ticker.add(tickLenis);
      gsap.ticker.lagSmoothing(0);
    }

    const refreshFrame = window.requestAnimationFrame(refresh);

    window.addEventListener("load", refresh, { once: true });
    window.addEventListener("resize", refresh);

    return () => {
      window.cancelAnimationFrame(refreshFrame);
      window.removeEventListener("load", refresh);
      window.removeEventListener("resize", refresh);
      removeLenisScroll?.();
      if (tickLenis) {
        gsap.ticker.remove(tickLenis);
      }
      lenis?.destroy();
    };
  }, []);

  return children;
}
