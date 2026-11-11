import type { HeroGeometryConfig } from "@/data/heroGeometry";
import { polygonPoints } from "@/lib/geometryCanvas";
import type { CanvasPoint, HeroGeometryGlyph } from "@/types/heroGeometry";

export function getGlyphLife(
  glyph: HeroGeometryGlyph,
  config: HeroGeometryConfig,
): number {
  return Math.max(0, 1 - glyph.ageMs / config.glyphLifeMs);
}

export function getGlyphRadius(glyph: HeroGeometryGlyph): number {
  const birth = Math.min(glyph.ageMs / 260, 1);
  return glyph.radius * (0.45 + birth * 0.55);
}

export function getGlyphRotation(
  glyph: HeroGeometryGlyph,
  timeMs: number,
): number {
  return glyph.rotation + Math.sin(timeMs * 0.001 + glyph.birthMs) * 0.1;
}

export function getGlyphPoints(
  glyph: HeroGeometryGlyph,
  timeMs: number,
): readonly CanvasPoint[] {
  return polygonPoints(glyph, getGlyphRadius(glyph), getGlyphRotation(glyph, timeMs));
}
