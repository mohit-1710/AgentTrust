import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { SectionMarker } from "@/data/sections";

interface SectionMarkerTriggerConfig {
  readonly markers: readonly SectionMarker[];
  readonly onActiveIndexChange: (index: number) => void;
}

interface ResolvedMarker {
  readonly index: number;
  readonly target: HTMLElement;
}

function resolveMarkers(markers: readonly SectionMarker[]): readonly ResolvedMarker[] {
  return markers.flatMap((marker, index) => {
    const target = document.querySelector<HTMLElement>(marker.href);

    return target ? [{ index, target }] : [];
  });
}

function findActiveIndex(markers: readonly ResolvedMarker[]): number {
  const viewportAnchor = window.innerHeight * 0.45;
  const fallback = markers[0]?.index ?? 0;

  return markers.reduce((activeIndex, marker) => {
    const rect = marker.target.getBoundingClientRect();

    if (rect.top <= viewportAnchor && rect.bottom > viewportAnchor) {
      return marker.index;
    }

    if (rect.top <= viewportAnchor) {
      return marker.index;
    }

    return activeIndex;
  }, fallback);
}

export function createSectionMarkerTriggers({
  markers,
  onActiveIndexChange,
}: SectionMarkerTriggerConfig): () => void {
  const resolvedMarkers = resolveMarkers(markers);

  if (resolvedMarkers.length === 0) {
    return () => undefined;
  }

  const setActiveIndex = (index: number) => {
    onActiveIndexChange(index);
  };

  const triggers = resolvedMarkers.map(({ index, target }) =>
    ScrollTrigger.create({
      trigger: target,
      start: "top 45%",
      end: "bottom 45%",
      onEnter: () => setActiveIndex(index),
      onEnterBack: () => setActiveIndex(index),
    }),
  );

  const handleRefresh = () => {
    setActiveIndex(findActiveIndex(resolvedMarkers));
  };

  ScrollTrigger.addEventListener("refresh", handleRefresh);
  window.requestAnimationFrame(handleRefresh);

  return () => {
    ScrollTrigger.removeEventListener("refresh", handleRefresh);
    triggers.forEach((trigger) => trigger.kill());
  };
}
