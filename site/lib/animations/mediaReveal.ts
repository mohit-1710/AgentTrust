import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface MediaRevealConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

export function createMediaReveal({
  isReducedMotion,
  root,
}: MediaRevealConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const heading = root.querySelector("[data-media-heading]");
  const copy = root.querySelector("[data-media-copy]");
  const cta = root.querySelector("[data-media-cta]");
  const cards = root.querySelectorAll("[data-media-card]");
  const targets = [heading, copy, cta, ...Array.from(cards)].filter(
    (target): target is Element => target !== null,
  );

  if (isReducedMotion) {
    gsap.set(targets, { autoAlpha: 1, clearProps: "transform" });

    return () => undefined;
  }

  gsap.set(heading, { y: 56 });
  gsap.set([copy, cta], { autoAlpha: 0, y: 22 });
  gsap.set(cards, { autoAlpha: 0, y: 20 });

  const timeline = gsap.timeline({
    scrollTrigger: {
      end: "top 34%",
      scrub: 1,
      start: "top 82%",
      trigger: root,
    },
  });

  timeline
    .to(heading, { duration: 0.18, ease: "power3.out", y: 0 }, 0)
    .to([copy, cta], {
      autoAlpha: 1,
      duration: 0.2,
      ease: "power3.out",
      stagger: 0.035,
      y: 0,
    }, 0.06)
    .to(cards, {
      autoAlpha: 1,
      duration: 0.22,
      ease: "power3.out",
      stagger: 0.045,
      y: 0,
    }, 0.12);

  return () => {
    timeline.scrollTrigger?.kill();
    timeline.kill();
  };
}
