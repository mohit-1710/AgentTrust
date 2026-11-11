import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface TrilemmaScrollAnimationConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

function existingElements(
  elements: readonly (Element | null)[],
): readonly Element[] {
  return elements.filter((element): element is Element => element !== null);
}

function prepareDrawPaths(paths: readonly SVGPathElement[]): void {
  paths.forEach((path) => {
    const length = path.getTotalLength();

    gsap.set(path, {
      strokeDasharray: length,
      strokeDashoffset: length,
    });
  });
}

export function createTrilemmaScrollAnimation({
  isReducedMotion,
  root,
}: TrilemmaScrollAnimationConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const lead = root.querySelector<HTMLElement>("[data-trilemma-lead]");
  const resolve = root.querySelector<HTMLElement>("[data-trilemma-resolve]");
  const center = root.querySelector<HTMLElement>("[data-trilemma-center]");
  const glyph = root.querySelector<SVGElement>("[data-trilemma-glyph]");
  const lines = root.querySelectorAll<HTMLElement>("[data-trilemma-line]");
  const nodes = root.querySelectorAll<SVGGElement>("[data-trilemma-node]");
  const paths = Array.from(
    root.querySelectorAll<SVGPathElement>("[data-trilemma-draw]"),
  );
  const media = gsap.matchMedia();
  const revealBlocks = existingElements([lead, resolve, center, glyph]);

  if (isReducedMotion) {
    gsap.set(revealBlocks, { autoAlpha: 1, clearProps: "transform" });
    gsap.set(lines, { clearProps: "transform" });
    gsap.set(nodes, { autoAlpha: 1, clearProps: "transform" });
    gsap.set(paths, { strokeDashoffset: 0 });

    return () => {
      media.revert();
    };
  }

  prepareDrawPaths(paths);
  gsap.set(existingElements([lead, resolve]), { autoAlpha: 0, y: 30 });
  gsap.set(existingElements([center, glyph]), { autoAlpha: 0 });
  gsap.set(lines, { yPercent: 120 });
  gsap.set(nodes, { autoAlpha: 0, scale: 0.76 });

  media.add("(prefers-reduced-motion: no-preference)", () => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        end: "bottom bottom",
        scrub: 1,
        start: "top 12%",
        trigger: root,
      },
    });

    timeline
      .to(glyph, { autoAlpha: 1, duration: 0.05, ease: "none" }, 0)
      .to(lead, { autoAlpha: 1, duration: 0.055, ease: "none", y: 0 }, 0.01)
      .to(lines, { yPercent: 0, duration: 0.11, ease: "power3.out" }, 0.025)
      .to(resolve, {
        autoAlpha: 1,
        duration: 0.07,
        ease: "power3.out",
        y: 0,
      }, 0.025)
      .to(paths, { strokeDashoffset: 0, duration: 0.32, ease: "none" }, 0.06)
      .to(nodes, {
        autoAlpha: 1,
        duration: 0.13,
        ease: "power3.out",
        scale: 1,
        stagger: 0.025,
      }, 0.12)
      .to(glyph, { rotate: 10, scale: 1.035, y: -28, duration: 0.6, ease: "none" }, 0.18)
      .to(nodes, { rotate: -6, duration: 0.54, ease: "none", stagger: 0.02 }, 0.24)
      .fromTo(center, {
        autoAlpha: 0,
        scale: 0.96,
        xPercent: 0,
        yPercent: -44,
      }, {
        autoAlpha: 1,
        duration: 0.14,
        ease: "power3.out",
        scale: 1,
        xPercent: 0,
        yPercent: -50,
      }, 0.68)
      .to(glyph, { rotate: -4, scale: 1, y: 0, duration: 0.2, ease: "none" }, 0.78);

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    };
  });

  return () => {
    media.revert();
  };
}
