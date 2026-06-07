import type { HeroGeometryConfig } from "@/data/heroGeometry";
import { drawDot, fillPolygon, rgba, strokePolygon } from "@/lib/geometryCanvas";
import {
  getGlyphLife,
  getGlyphPoints,
} from "@/lib/heroGeometryShape";
import { drawPointerVertexWeb, drawVertexWeb } from "@/lib/heroGeometryWeb";
import type { HeroGeometryGlyph, HeroGeometryState } from "@/types/heroGeometry";

export function drawHeroGeometry(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: HeroGeometryState,
  config: HeroGeometryConfig,
  timeMs: number,
): void {
  context.clearRect(0, 0, width, height);
  if (!state.isHovering && state.glyphs.length === 0) {
    return;
  }

  drawVertexWeb(context, state, config, timeMs);
  state.glyphs.forEach((glyph) => drawGlyph(context, glyph, config, timeMs));
  drawPointerGlyph(context, state, config, timeMs);
}

function drawGlyph(
  context: CanvasRenderingContext2D,
  glyph: HeroGeometryGlyph,
  config: HeroGeometryConfig,
  timeMs: number,
): void {
  const life = getGlyphLife(glyph, config);
  const points = getGlyphPoints(glyph, timeMs);

  fillPolygon(context, points, rgba(config.accent, life * 0.055));
  strokePolygon(context, points, rgba(config.accent, life), 2);
  strokePolygon(context, points, rgba(config.ink, life * 0.46), 1);

  points.forEach((point, index) => {
    const color = index % 2 === 0 ? config.accent : config.ink;
    drawDot(context, point, 3.2, rgba(color, life * 0.8));
  });
}

function drawPointerGlyph(
  context: CanvasRenderingContext2D,
  state: HeroGeometryState,
  config: HeroGeometryConfig,
  timeMs: number,
): void {
  if (!state.isHovering) {
    return;
  }

  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = timeMs * 0.0014 + (Math.PI * 2 * index) / 6;
    return {
      x: state.pointerX + Math.cos(angle) * 44,
      y: state.pointerY + Math.sin(angle) * 44,
    };
  });

  fillPolygon(context, points, rgba(config.accent, 0.055));
  strokePolygon(context, points, rgba(config.accent, 0.94), 1.9);
  points.forEach((point) => drawDot(context, point, 2.8, rgba(config.accent, 0.82)));
  drawPointerVertexWeb(context, state, config, points, timeMs);
}
