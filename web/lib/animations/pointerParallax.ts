import gsap from "gsap";

interface PointerParallaxConfig {
  readonly duration?: number;
  readonly maxRotation?: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly root: HTMLElement;
  readonly targetSelector: string;
}

function readFactor(target: Element, attribute: string): number {
  const value = target.getAttribute(attribute);
  const parsed = value === null ? Number.NaN : Number(value);

  return Number.isFinite(parsed) ? parsed : 1;
}

export function createPointerParallax({
  duration = 0.8,
  maxRotation = 0,
  maxX,
  maxY,
  root,
  targetSelector,
}: PointerParallaxConfig): () => void {
  const targets = Array.from(root.querySelectorAll<Element>(targetSelector));

  if (targets.length === 0) {
    return () => undefined;
  }

  const xSetters = targets.map((target) =>
    gsap.quickTo(target, "x", { duration, ease: "power3.out" }),
  );
  const ySetters = targets.map((target) =>
    gsap.quickTo(target, "y", { duration, ease: "power3.out" }),
  );
  const rotationSetters = targets.map((target) =>
    gsap.quickTo(target, "rotation", { duration, ease: "power3.out" }),
  );

  const handlePointerMove = (event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    const xRatio = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const yRatio = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    targets.forEach((target, index) => {
      const xFactor = readFactor(target, "data-parallax-x");
      const yFactor = readFactor(target, "data-parallax-y");
      const rotationFactor = readFactor(target, "data-parallax-rotate");

      xSetters[index](xRatio * maxX * xFactor);
      ySetters[index](yRatio * maxY * yFactor);
      rotationSetters[index](xRatio * maxRotation * rotationFactor);
    });
  };

  const handlePointerLeave = () => {
    xSetters.forEach((setX) => setX(0));
    ySetters.forEach((setY) => setY(0));
    rotationSetters.forEach((setRotation) => setRotation(0));
  };

  root.addEventListener("pointermove", handlePointerMove);
  root.addEventListener("pointerleave", handlePointerLeave);

  return () => {
    root.removeEventListener("pointermove", handlePointerMove);
    root.removeEventListener("pointerleave", handlePointerLeave);
    gsap.set(targets, { clearProps: "rotation,x,y" });
  };
}
