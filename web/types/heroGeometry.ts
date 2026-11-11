import type { HeroPolygonSides } from "@/data/heroGeometry";

export interface HeroGeometryGlyph {
  ageMs: number;
  readonly birthMs: number;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly rotation: number;
  readonly sides: HeroPolygonSides;
}

export interface HeroGeometryState {
  glyphs: HeroGeometryGlyph[];
  isHovering: boolean;
  lastSpawnMs: number;
  lastSpawnX: number;
  lastSpawnY: number;
  pointerX: number;
  pointerY: number;
  sequenceIndex: number;
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasNode {
  readonly cx: number;
  readonly cy: number;
}
