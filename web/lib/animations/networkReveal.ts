import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface NetworkRevealConfig {
  readonly isReducedMotion: boolean;
  readonly root: HTMLElement;
}

export function createNetworkReveal({
  isReducedMotion,
  root,
}: NetworkRevealConfig): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const context = gsap.context(() => {
    const revealItems = root.querySelectorAll<HTMLElement>(
      "[data-network-reveal]",
    );
    const globe = root.querySelector<HTMLElement>("[data-network-globe]");
    const trigger = root.closest("section") ?? root;

    if (isReducedMotion) {
      gsap.set(revealItems, { autoAlpha: 1, clearProps: "transform" });
      gsap.set(globe, { autoAlpha: 1, scale: 1, y: 0 });
      return;
    }

    gsap
      .timeline({
        scrollTrigger: {
          trigger,
          start: "top top",
          end: "+=620",
          scrub: 1,
        },
      })
      .fromTo(
        revealItems,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          stagger: 0.1,
        },
      );

    if (globe) {
      gsap.fromTo(
        globe,
        { autoAlpha: 0, scale: 0.86, y: 44 },
        {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger,
            start: "top top",
            end: "70% bottom",
            scrub: 1,
          },
        },
      );
    }
  }, root);

  return () => context.revert();
}
