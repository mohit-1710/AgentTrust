"use client";

import MonadBenchmarkLayer from "@/components/MonadBenchmarkLayer";
import styles from "@/components/StorytellingSection.module.css";
import { MONAD_BENCHMARK_VISUALS } from "@/data/monadBenchmarkVisuals";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { StoryVisualKind } from "@/types/storytelling";

interface MonadBenchmarkVisualProps {
  readonly isActive: boolean;
  readonly kind: StoryVisualKind;
}

export default function MonadBenchmarkVisual({
  isActive,
  kind,
}: MonadBenchmarkVisualProps) {
  const shouldReduceMotion = useReducedMotion();
  const visual = MONAD_BENCHMARK_VISUALS[kind];

  return (
    <span className={styles.lottieStack}>
      {visual.layers.map((layer) => (
        <MonadBenchmarkLayer
          isActive={isActive}
          key={layer.className}
          layer={layer}
          shouldReduceMotion={shouldReduceMotion}
        />
      ))}
    </span>
  );
}
