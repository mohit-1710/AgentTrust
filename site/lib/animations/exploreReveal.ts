import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ExploreRevealConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

export function createExploreReveal({
  isReducedMotion,
  root,
}: ExploreRevealConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const heading = root.querySelector<HTMLElement>("[data-explore-heading]");
  const cards = root.querySelectorAll<HTMLElement>("[data-explore-card]");
  const panels = root.querySelectorAll<HTMLElement>("[data-explore-card-panel]");
  const media = gsap.matchMedia();

  if (isReducedMotion) {
    gsap.set(heading, { clearProps: "transform" });
    gsap.set(panels, { clipPath: "inset(0% 0% 0%)" });
    gsap.set(cards, { autoAlpha: 1, clearProps: "transform" });

    return () => {
      media.revert();
    };
  }

  gsap.set(heading, { yPercent: 120 });
  gsap.set(cards, { autoAlpha: 0, y: 28 });
  gsap.set(panels, { clipPath: "inset(0% 0% 100%)" });

  media.add("(prefers-reduced-motion: no-preference)", () => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top 72%",
        once: true,
      },
    });

    timeline
      .to(heading, { yPercent: 0, duration: 1, ease: "power3.out" }, 0)
      .to(cards, {
        autoAlpha: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
        y: 0,
      }, 0.18)
      .to(panels, {
        clipPath: "inset(0% 0% 0%)",
        duration: 1.05,
        ease: "power3.out",
        stagger: 0.1,
      }, 0.18);

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    };
  });

  return () => {
    media.revert();
  };
}
