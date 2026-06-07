import gsap from "gsap";

export function createHeroIntroTimeline(root: HTMLElement): gsap.core.Timeline {
  const heroLines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", root);
  const rules = gsap.utils.toArray<HTMLElement>("[data-hero-rule]", root);
  const fades = gsap.utils.toArray<HTMLElement>("[data-hero-fade]", root);
  const video = root.querySelector<HTMLElement>("[data-hero-video]");

  const timeline = gsap.timeline({
    defaults: {
      duration: 1.15,
      ease: "expo.out",
    },
  });

  timeline
    .from(heroLines, {
      yPercent: 112,
      opacity: 0,
      stagger: 0.08,
    })
    .from(
      rules,
      {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.2,
      },
      "-=0.82",
    )
    .from(
      fades,
      {
        y: 18,
        opacity: 0,
        stagger: 0.06,
      },
      "-=0.72",
    );

  if (video) {
    timeline.from(
      video,
      {
        clipPath: "inset(0% 0% 100% 0%)",
        duration: 1.35,
      },
      "-=0.88",
    );
  }

  return timeline;
}
