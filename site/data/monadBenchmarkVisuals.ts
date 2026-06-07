import cc from "@/data/benchmark-assets/CC.json";
import ccDotted from "@/data/benchmark-assets/CCDotted.json";
import ccGreebles from "@/data/benchmark-assets/CCGreebles.json";
import dbd from "@/data/benchmark-assets/DBD.json";
import dbdDotted from "@/data/benchmark-assets/DBDDotted.json";
import dbdGreebles from "@/data/benchmark-assets/DBDGreebles.json";
import fff from "@/data/benchmark-assets/FFF.json";
import fffDotted from "@/data/benchmark-assets/FFFDotted.json";
import fffGreebles from "@/data/benchmark-assets/FFFGreebles.json";
import type { StoryVisualKind } from "@/types/storytelling";

export type MonadBenchmarkLayerKind = "base" | "dotted" | "greebles";

export interface MonadBenchmarkLayer {
  readonly animationData: unknown;
  readonly className: MonadBenchmarkLayerKind;
}

export interface MonadBenchmarkVisual {
  readonly layers: readonly MonadBenchmarkLayer[];
}

export const MONAD_BENCHMARK_VISUALS: Record<
  StoryVisualKind,
  MonadBenchmarkVisual
> = {
  identity: {
    layers: [
      { animationData: fff, className: "base" },
      { animationData: fffDotted, className: "dotted" },
      { animationData: fffGreebles, className: "greebles" },
    ],
  },
  policy: {
    layers: [
      { animationData: dbd, className: "base" },
      { animationData: dbdDotted, className: "dotted" },
      { animationData: dbdGreebles, className: "greebles" },
    ],
  },
  proofs: {
    layers: [
      { animationData: cc, className: "base" },
      { animationData: ccDotted, className: "dotted" },
      { animationData: ccGreebles, className: "greebles" },
    ],
  },
} as const;
