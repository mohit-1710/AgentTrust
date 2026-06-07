import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createPointerParallax } from "@/lib/animations/pointerParallax";

interface BenchmarkMotionConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

export function createBenchmarkMotion({
  isReducedMotion,
  root,
}: BenchmarkMotionConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const corners = root.querySelectorAll<HTMLElement>("[data-benchmark-corner]");
  const lines = root.querySelectorAll<HTMLElement>("[data-benchmark-line]");

  if (isReducedMotion) {
    gsap.set([...Array.from(corners), ...Array.from(lines)], {
      autoAlpha: 1,
      clearProps: "transform",
    });

    return () => undefined;
  }

  gsap.set(corners, { autoAlpha: 0, scale: 0.7 });
  gsap.set(lines, { yPercent: 112 });

  const timeline = gsap.timeline({
    scrollTrigger: {
      once: true,
      start: "top 76%",
      trigger: root,
    },
  });

  timeline
    .to(corners, {
      autoAlpha: 1,
      duration: 0.52,
      ease: "power3.out",
      scale: 1,
      stagger: 0.045,
    }, 0)
    .to(lines, {
      duration: 1.05,
      ease: "power4.out",
      stagger: 0.095,
      yPercent: 0,
    }, 0.08);

  const cleanupParallax = createPointerParallax({
    duration: 0.78,
    maxRotation: 0.22,
    maxX: 14,
    maxY: 5,
    root,
    targetSelector: "[data-benchmark-heading], [data-benchmark-corner]",
  });

  return () => {
    cleanupParallax();
    timeline.scrollTrigger?.kill();
    timeline.kill();
  };
}
