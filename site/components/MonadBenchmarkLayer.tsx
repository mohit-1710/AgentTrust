"use client";

import { useEffect, useRef } from "react";
import Lottie from "lottie-react";
import styles from "@/components/StorytellingSection.module.css";
import type { MonadBenchmarkLayer as MonadBenchmarkLayerData } from "@/data/monadBenchmarkVisuals";
import type { LottieRefCurrentProps } from "lottie-react";

interface MonadBenchmarkLayerProps {
  readonly isActive: boolean;
  readonly layer: MonadBenchmarkLayerData;
  readonly shouldReduceMotion: boolean;
}

function getLayerClassName(layer: MonadBenchmarkLayerData): string {
  if (layer.className === "dotted") {
    return `${styles.lottieLayer} ${styles.lottieDotted}`;
  }

  if (layer.className === "greebles") {
    return `${styles.lottieLayer} ${styles.lottieGreebles}`;
  }

  return styles.lottieLayer;
}

function getLastFrame(lottie: LottieRefCurrentProps): number {
  const duration = lottie.getDuration(true);

  return duration ? Math.max(0, duration - 1) : 0;
}

function shouldLoopLayer(layer: MonadBenchmarkLayerData): boolean {
  return layer.className === "dotted";
}

export default function MonadBenchmarkLayer({
  isActive,
  layer,
  shouldReduceMotion,
}: MonadBenchmarkLayerProps) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const lottie = lottieRef.current;

    if (!lottie) {
      return;
    }

    if (shouldReduceMotion) {
      lottie.goToAndStop(getLastFrame(lottie), true);
      return;
    }

    if (isActive) {
      lottie.goToAndPlay(0, true);
      return;
    }

    lottie.goToAndStop(0, true);
  }, [isActive, shouldReduceMotion]);

  return (
    <span
      className={getLayerClassName(layer)}
      data-story-dotted-layer={layer.className === "dotted" ? "true" : undefined}
    >
      <Lottie
        animationData={layer.animationData}
        autoplay={false}
        loop={isActive && !shouldReduceMotion && shouldLoopLayer(layer)}
        lottieRef={lottieRef}
      />
    </span>
  );
}
