import type {
  CanvasNode,
  CanvasPoint,
  HeroGeometryGlyph,
} from "@/types/heroGeometry";

export function polygonPoints(
  glyph: HeroGeometryGlyph,
  radius: number,
  rotation: number,
): readonly CanvasPoint[] {
  return Array.from({ length: glyph.sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / glyph.sides;
    return {
      x: glyph.cx + Math.cos(angle) * radius,
      y: glyph.cy + Math.sin(angle) * radius,
    };
  });
}

export function strokePolygon(
  context: CanvasRenderingContext2D,
  points: readonly CanvasPoint[],
  strokeStyle: string,
  lineWidth: number,
): void {
  const first = points[0];
  if (!first) {
    return;
  }

  context.beginPath();
  context.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

export function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly CanvasPoint[],
  fillStyle: string,
): void {
  const first = points[0];
  if (!first) {
    return;
  }

  context.beginPath();
  context.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

export function strokeLine(
  context: CanvasRenderingContext2D,
  from: CanvasNode,
  to: CanvasNode,
  strokeStyle: string,
  lineWidth: number,
): void {
  context.beginPath();
  context.moveTo(from.cx, from.cy);
  context.lineTo(to.cx, to.cy);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

export function strokePointLine(
  context: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  strokeStyle: string,
  lineWidth: number,
): void {
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

export function drawDot(
  context: CanvasRenderingContext2D,
  point: CanvasPoint,
  radius: number,
  fillStyle: string,
): void {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = fillStyle;
  context.fill();
}

export function hashNumber(a: number, b: number): number {
  const raw = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

export function rgba(color: string, alpha: number): string {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
