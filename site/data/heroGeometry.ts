export type HeroPolygonSides = 3 | 6 | 8;

export interface HeroGeometryConfig {
  readonly accent: string;
  readonly connectionDistance: number;
  readonly glyphLifeMs: number;
  readonly ink: string;
  readonly maxGlyphs: number;
  readonly spawnDistance: number;
  readonly spawnIntervalMs: number;
}

export const HERO_GEOMETRY_CONFIG: HeroGeometryConfig = {
  accent: "#6f4cff",
  connectionDistance: 340,
  glyphLifeMs: 14000,
  ink: "#0a0a0a",
  maxGlyphs: 108,
  spawnDistance: 8,
  spawnIntervalMs: 16,
};

export const HERO_POLYGON_SEQUENCE: readonly HeroPolygonSides[] = [
  3, 6, 8, 6,
];
