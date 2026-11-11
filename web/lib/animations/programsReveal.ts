import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ProgramsRevealConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
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

export function createProgramsReveal({
  isReducedMotion,
  root,
}: ProgramsRevealConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const fades = root.querySelectorAll<HTMLElement>("[data-programs-fade]");
  const cards = root.querySelectorAll<HTMLElement>("[data-programs-card]");
  const paths = Array.from(
    root.querySelectorAll<SVGPathElement>("[data-programs-draw]"),
  );
  const nodes = root.querySelectorAll<SVGElement>("[data-programs-node]");
  const media = gsap.matchMedia();

  if (isReducedMotion) {
    gsap.set(fades, { autoAlpha: 1, clearProps: "transform" });
    gsap.set(cards, { autoAlpha: 1, clearProps: "transform" });
    gsap.set(paths, { strokeDashoffset: 0 });
    gsap.set(nodes, { autoAlpha: 1, scale: 1 });

    return () => {
      media.revert();
    };
  }

  prepareDrawPaths(paths);
  gsap.set(fades, { autoAlpha: 0, y: 24 });
  gsap.set(cards, { autoAlpha: 0, y: 30 });
  gsap.set(nodes, { autoAlpha: 0, scale: 0.5 });

  media.add("(prefers-reduced-motion: no-preference)", () => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top 74%",
        once: true,
      },
    });

    timeline
      .to(
        fades,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
        },
        0,
      )
      .to(
        cards,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.12,
        },
        0.28,
      )
      .to(
        paths,
        {
          strokeDashoffset: 0,
          duration: 0.95,
          ease: "power2.inOut",
          stagger: 0.08,
        },
        0.62,
      )
      .to(
        nodes,
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.45,
          ease: "back.out(2.2)",
          stagger: 0.05,
        },
        0.78,
      );

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    };
  });

  return () => {
    media.revert();
  };
}
