import gsap from "gsap";

interface EventFollowerMotionConfig {
  readonly follower: HTMLElement;
  readonly isReducedMotion: boolean;
}

interface EventFollowerMotion {
  readonly hide: () => void;
  readonly kill: () => void;
  readonly moveTo: (clientX: number, clientY: number) => void;
  readonly show: () => void;
}

export function createEventFollowerMotion({
  follower,
  isReducedMotion,
}: EventFollowerMotionConfig): EventFollowerMotion {
  const xTo = gsap.quickTo(follower, "x", {
    duration: isReducedMotion ? 0 : 0.42,
    ease: "power3.out",
  });
  const yTo = gsap.quickTo(follower, "y", {
    duration: isReducedMotion ? 0 : 0.42,
    ease: "power3.out",
  });

  gsap.set(follower, { autoAlpha: 0, scale: 0.96, x: 0, y: 0 });

  return {
    hide: () => {
      gsap.to(follower, {
        autoAlpha: 0,
        duration: isReducedMotion ? 0 : 0.16,
        ease: "power3.out",
        scale: 0.96,
      });
    },
    kill: () => {
      gsap.killTweensOf(follower);
    },
    moveTo: (clientX: number, clientY: number) => {
      xTo(clientX - 136);
      yTo(clientY - 136);
    },
    show: () => {
      gsap.to(follower, {
        autoAlpha: 1,
        duration: isReducedMotion ? 0 : 0.18,
        ease: "power3.out",
        scale: 1,
      });
    },
  };
}
