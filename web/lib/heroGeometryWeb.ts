import type { HeroGeometryConfig } from "@/data/heroGeometry";
import { rgba, strokePointLine } from "@/lib/geometryCanvas";
import { getGlyphLife, getGlyphPoints } from "@/lib/heroGeometryShape";
import type {
  CanvasPoint,
  HeroGeometryGlyph,
  HeroGeometryState,
} from "@/types/heroGeometry";

interface WebVertex {
  readonly glyph: HeroGeometryGlyph;
  readonly glyphIndex: number;
  readonly isTriangleCorner: boolean;
  readonly life: number;
  readonly point: CanvasPoint;
  readonly vertexIndex: number;
}

export function drawVertexWeb(
  context: CanvasRenderingContext2D,
  state: HeroGeometryState,
  config: HeroGeometryConfig,
  timeMs: number,
): void {
  const vertices = collectVertices(state, config, timeMs);

  vertices.filter((vertex) => vertex.isTriangleCorner).forEach((vertex) => {
    const links = findVertexLinks(vertex, vertices, config);
    links.forEach((link) => {
      const distance = pointDistance(vertex.point, link.point);
      const distanceAlpha = 1 - distance / config.connectionDistance;
      const anchorAlpha = vertex.isTriangleCorner ? 0.9 : 0.42;
      const alpha = distanceAlpha * anchorAlpha * Math.min(vertex.life, link.life);
      const color = vertex.isTriangleCorner ? config.accent : config.ink;
      strokePointLine(
        context,
        vertex.point,
        link.point,
        rgba(color, alpha),
        vertex.isTriangleCorner ? 1.5 : 1,
      );
    });
  });
}

export function drawPointerVertexWeb(
  context: CanvasRenderingContext2D,
  state: HeroGeometryState,
  config: HeroGeometryConfig,
  pointerPoints: readonly CanvasPoint[],
  timeMs: number,
): void {
  const vertices = collectVertices(state, config, timeMs).slice(-42);

  pointerPoints.forEach((point, index) => {
    const nearest = vertices
      .filter((vertex) => pointDistance(point, vertex.point) < config.connectionDistance)
      .sort((a, b) => pointDistance(point, a.point) - pointDistance(point, b.point))
      .slice(0, index % 2 === 0 ? 2 : 1);

    nearest.forEach((vertex) => {
      const distance = pointDistance(point, vertex.point);
      const alpha = 0.58 * (1 - distance / config.connectionDistance) * vertex.life;
      strokePointLine(context, point, vertex.point, rgba(config.accent, alpha), 1.15);
    });
  });
}

function collectVertices(
  state: HeroGeometryState,
  config: HeroGeometryConfig,
  timeMs: number,
): readonly WebVertex[] {
  return state.glyphs.flatMap((glyph, glyphIndex) => {
    const life = getGlyphLife(glyph, config);
    return getGlyphPoints(glyph, timeMs).map((point, vertexIndex) => ({
      glyph,
      glyphIndex,
      isTriangleCorner: glyph.sides === 3,
      life,
      point,
      vertexIndex,
    }));
  });
}

function findVertexLinks(
  vertex: WebVertex,
  vertices: readonly WebVertex[],
  config: HeroGeometryConfig,
): readonly WebVertex[] {
  const linkCount = vertex.isTriangleCorner ? 3 : 1;

  return vertices
    .filter((candidate) => {
      if (candidate.glyphIndex === vertex.glyphIndex) {
        return false;
      }

      return pointDistance(vertex.point, candidate.point) < config.connectionDistance;
    })
    .sort((a, b) => pointDistance(vertex.point, a.point) - pointDistance(vertex.point, b.point))
    .slice(0, linkCount);
}

function pointDistance(from: CanvasPoint, to: CanvasPoint): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}
