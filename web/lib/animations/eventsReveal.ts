import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface EventsRevealConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

export function createEventsReveal({
  isReducedMotion,
  root,
}: EventsRevealConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const heading = root.querySelector("[data-events-heading]");
  const copy = root.querySelector("[data-events-copy]");
  const cta = root.querySelector("[data-events-cta]");
  const rows = root.querySelectorAll("[data-events-row]");
  const targets = [heading, copy, cta, ...Array.from(rows)].filter(
    (target): target is Element => target !== null,
  );

  if (isReducedMotion) {
    gsap.set(targets, { autoAlpha: 1, clearProps: "transform" });

    return () => undefined;
  }

  gsap.set(heading, { y: 56 });
  gsap.set([copy, cta], { autoAlpha: 0, y: 22 });
  gsap.set(rows, { autoAlpha: 0, y: 18 });

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
    .to(rows, {
      autoAlpha: 1,
      duration: 0.24,
      ease: "power3.out",
      stagger: 0.035,
      y: 0,
    }, 0.12);

  return () => {
    timeline.scrollTrigger?.kill();
    timeline.kill();
  };
}
