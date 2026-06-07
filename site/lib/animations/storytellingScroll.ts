import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface StorytellingScrollConfig {
  readonly count: number;
  readonly onActiveIndexChange: (index: number) => void;
  readonly root: HTMLElement;
}

const VISUAL_PANEL_STEP = 900;
const VISUAL_FADE_DISTANCE = 1.05;
const PROGRESS_LERP = 0.17;
const PROGRESS_EPSILON = 0.0004;
const ACTIVE_INDEX_THRESHOLD = 0.68;
const COPY_EXIT_START = 0.5;
const COPY_EXIT_END = 0.76;
const COPY_ENTER_START = 0.6;
const COPY_ENTER_END = 0.9;
const COPY_PRIMARY_SHIFT = 20;
const COPY_SECONDARY_SHIFT = 14;

function getActiveIndex(position: number, count: number): number {
  return gsap.utils.clamp(
    0,
    count - 1,
    Math.floor(position + ACTIVE_INDEX_THRESHOLD),
  );
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function getVisualPanelVisibility(
  position: number,
  index: number,
  count: number,
): number {
  const maxIndex = count - 1;

  if (maxIndex <= 0) {
    return 1;
  }

  const clampedPosition = gsap.utils.clamp(0, maxIndex, position);
  const distance = Math.abs(index - clampedPosition);
  const rawVisibility = gsap.utils.clamp(
    0,
    1,
    1 - distance / VISUAL_FADE_DISTANCE,
  );

  return smoothStep(rawVisibility);
}

function getVisualPanelOffset(
  position: number,
  index: number,
  range: number,
): number {
  return gsap.utils.clamp(-range, range, (index - position) * range);
}

function getSegmentVisibility(
  position: number,
  index: number,
  count: number,
  enterStart: number,
  enterEnd: number,
  exitStart: number,
  exitEnd: number,
): number {
  const maxIndex = count - 1;
  const clampedPosition = gsap.utils.clamp(0, maxIndex, position);
  const currentIndex = Math.floor(clampedPosition);
  const nextIndex = Math.min(maxIndex, currentIndex + 1);
  const segmentProgress = clampedPosition - currentIndex;

  if (maxIndex <= 0) {
    return 1;
  }

  if (index === currentIndex) {
    const exitProgress = gsap.utils.clamp(
      0,
      1,
      (segmentProgress - exitStart) / (exitEnd - exitStart),
    );

    return smoothStep(1 - exitProgress);
  }

  if (index === nextIndex && nextIndex !== currentIndex) {
    const enterProgress = gsap.utils.clamp(
      0,
      1,
      (segmentProgress - enterStart) / (enterEnd - enterStart),
    );

    return smoothStep(enterProgress);
  }

  return 0;
}

function getCopyOffset(
  visibility: number,
  index: number,
  position: number,
): number {
  const direction = index < position ? -1 : 1;

  return direction * (1 - visibility);
}

function getExistingElements(
  elements: readonly (HTMLElement | null)[],
): HTMLElement[] {
  return elements.filter((element): element is HTMLElement => element !== null);
}

function setCopyChildren(
  panel: HTMLElement,
  position: number,
  index: number,
  count: number,
): number {
  const primaryVisibility = getSegmentVisibility(
    position,
    index,
    count,
    COPY_ENTER_START,
    COPY_ENTER_END,
    COPY_EXIT_START,
    COPY_EXIT_END,
  );
  const secondaryVisibility = getSegmentVisibility(
    position,
    index,
    count,
    COPY_ENTER_START + 0.05,
    COPY_ENTER_END,
    COPY_EXIT_START - 0.04,
    COPY_EXIT_END,
  );
  const eyebrow = panel.querySelector<HTMLElement>("[data-story-copy-eyebrow]");
  const title = panel.querySelector<HTMLElement>("[data-story-copy-title]");
  const body = panel.querySelector<HTMLElement>("[data-story-copy-body]");
  const rule = panel.querySelector<HTMLElement>("[data-story-copy-rule]");
  const action = panel.querySelector<HTMLElement>("[data-story-copy-action]");
  const primaryY =
    getCopyOffset(primaryVisibility, index, position) * COPY_PRIMARY_SHIFT;
  const secondaryY =
    getCopyOffset(secondaryVisibility, index, position) * COPY_SECONDARY_SHIFT;

  gsap.set(getExistingElements([eyebrow, title]), {
    autoAlpha: primaryVisibility,
    y: primaryY,
  });
  gsap.set(getExistingElements([body, rule, action]), {
    autoAlpha: secondaryVisibility,
    y: secondaryY,
  });

  return Math.max(primaryVisibility, secondaryVisibility);
}

function setDottedReveal(panel: HTMLElement, position: number, index: number) {
  const dottedLayer = panel.querySelector<HTMLElement>(
    "[data-story-dotted-layer]",
  );

  if (!dottedLayer) {
    return;
  }

  const incomingDistance = gsap.utils.clamp(0, 1, index - position);
  const clipInset = incomingDistance * 50;

  gsap.set(dottedLayer, {
    clipPath: `inset(${clipInset}% 0%)`,
  });
}

function setPanels(progress: number, root: HTMLElement, count: number): void {
  const position = progress * Math.max(1, count - 1);
  const activeIndex = getActiveIndex(position, count);
  const copyPanels = root.querySelectorAll<HTMLElement>(
    "[data-story-copy-panel]",
  );
  const visualPanels = root.querySelectorAll<HTMLElement>(
    "[data-story-visual-panel]",
  );

  copyPanels.forEach((panel, index) => {
    const visibility = setCopyChildren(panel, position, index, count);

    gsap.set(panel, {
      autoAlpha: visibility,
      pointerEvents: index === activeIndex ? "auto" : "none",
      zIndex: Math.round(visibility * 10),
      y: 0,
    });
  });

  visualPanels.forEach((panel, index) => {
    const visibility = getVisualPanelVisibility(position, index, count);

    setDottedReveal(panel, position, index);

    gsap.set(panel, {
      autoAlpha: visibility,
      scale: 0.985 + visibility * 0.015,
      zIndex: Math.round(visibility * 10),
      y: getVisualPanelOffset(position, index, VISUAL_PANEL_STEP),
    });
  });
}

export function createStorytellingScrollTrigger({
  count,
  onActiveIndexChange,
  root,
}: StorytellingScrollConfig): () => void {
  setPanels(0, root, count);

  let currentProgress = 0;
  let targetProgress = 0;
  let animationFrame = 0;

  const render = (progress: number) => {
    const activePosition = progress * Math.max(1, count - 1);
    const nextIndex = getActiveIndex(activePosition, count);

    setPanels(progress, root, count);
    onActiveIndexChange(nextIndex);
  };

  const tick = () => {
    const delta = targetProgress - currentProgress;

    if (Math.abs(delta) < PROGRESS_EPSILON) {
      currentProgress = targetProgress;
      render(currentProgress);
      animationFrame = 0;
      return;
    }

    currentProgress += delta * PROGRESS_LERP;
    render(currentProgress);
    animationFrame = window.requestAnimationFrame(tick);
  };

  const requestTick = () => {
    if (animationFrame === 0) {
      animationFrame = window.requestAnimationFrame(tick);
    }
  };

  const trigger = ScrollTrigger.create({
    trigger: root,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      targetProgress = self.progress;
      requestTick();
    },
  });

  return () => {
    if (animationFrame !== 0) {
      window.cancelAnimationFrame(animationFrame);
    }

    trigger.kill();
  };
}
