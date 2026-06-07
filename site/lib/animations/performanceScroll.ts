import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface PerformanceScrollAnimationConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

function readNumberAttribute(
  element: HTMLElement,
  name: string,
): number | null {
  const value = element.getAttribute(name);
  const parsed = value === null ? Number.NaN : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatCounterValue(
  value: number,
  decimals: number,
  suffix: string,
): string {
  return `${value.toFixed(decimals)}${suffix}`;
}

function setCounterProgress(counter: HTMLElement, progress: number): void {
  const from = readNumberAttribute(counter, "data-count-from");
  const target = readNumberAttribute(counter, "data-count-target");
  const decimals = readNumberAttribute(counter, "data-count-decimals") ?? 0;
  const suffix = counter.getAttribute("data-count-suffix") ?? "";

  if (from === null || target === null) {
    return;
  }

  const clampedProgress = gsap.utils.clamp(0, 1, progress);
  const current = gsap.utils.interpolate(from, target, clampedProgress);
  counter.textContent = formatCounterValue(current, decimals, suffix);
}

function setCountersProgress(root: HTMLElement, progress: number): void {
  const counters = root.querySelectorAll<HTMLElement>("[data-performance-count]");

  counters.forEach((counter) => {
    setCounterProgress(counter, progress);
  });
}

export function createPerformanceScrollAnimation({
  isReducedMotion,
  root,
}: PerformanceScrollAnimationConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const revealItems = root.querySelectorAll<HTMLElement>(
    "[data-performance-reveal]",
  );
  const bars = root.querySelectorAll<HTMLElement>("[data-performance-bar]");
  const radar = root.querySelector<HTMLElement>("[data-performance-radar]");
  const media = gsap.matchMedia();

  if (isReducedMotion) {
    gsap.set(revealItems, {
      autoAlpha: 1,
      clearProps: "transform",
    });
    gsap.set(bars, { autoAlpha: 1, clearProps: "transform" });
    setCountersProgress(root, 1);

    if (radar) {
      gsap.set(radar, { autoAlpha: 1, clearProps: "transform" });
    }

    return () => {
      media.revert();
    };
  }

  media.add("(min-width: 940px)", () => {
    // The stage is already pinned via CSS `position: sticky` (PerformanceScroll.module.css,
    // .stage + .pinArea height: 350dvh). A second GSAP `pin` here inserts a pin-spacer and
    // flips the stage to fixed positioning on top of the sticky, which fights it and shifts
    // the absolutely-positioned bars — the source of the section's layout shift (CLS). Rely
    // on the CSS sticky alone; GSAP only scrubs the counters.
    const counterTrigger = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        setCountersProgress(root, self.progress);
      },
    });

    setCountersProgress(root, 0);

    return () => {
      counterTrigger.kill();
    };
  });

  media.add("(max-width: 939px)", () => {
    const counterTrigger = ScrollTrigger.create({
      trigger: root,
      start: "top 72%",
      end: "bottom 38%",
      scrub: 1,
      onUpdate: (self) => {
        setCountersProgress(root, self.progress);
      },
    });

    setCountersProgress(root, 0);

    return () => {
      counterTrigger.kill();
    };
  });

  gsap.fromTo(
    revealItems,
    { autoAlpha: 0, y: 30 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.16,
      scrollTrigger: {
        trigger: root,
        start: "top 72%",
        once: true,
      },
    },
  );

  gsap.fromTo(
    bars,
    { scaleY: 0.22, transformOrigin: "50% 100%" },
    {
      scaleY: 1,
      ease: "none",
      stagger: { each: 0.012, from: "start" },
      scrollTrigger: {
        trigger: root,
        start: "top 65%",
        end: "72% bottom",
        scrub: 1,
      },
    },
  );

  if (radar) {
    gsap.fromTo(
      radar,
      { autoAlpha: 0, scale: 0.82, y: 42 },
      {
        autoAlpha: 1,
        scale: 1,
        y: 0,
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "18% 62%",
          end: "76% bottom",
          scrub: 1,
        },
      },
    );
  }

  return () => {
    media.revert();
  };
}
