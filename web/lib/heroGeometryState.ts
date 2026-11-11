import {
  HERO_POLYGON_SEQUENCE,
  type HeroGeometryConfig,
} from "@/data/heroGeometry";
import { hashNumber } from "@/lib/geometryCanvas";
import type { HeroGeometryState } from "@/types/heroGeometry";

export function createHeroGeometryState(): HeroGeometryState {
  return {
    glyphs: [],
    isHovering: false,
    lastSpawnMs: 0,
    lastSpawnX: 0,
    lastSpawnY: 0,
    pointerX: 0,
    pointerY: 0,
    sequenceIndex: 0,
  };
}

export function updateHeroGeometryPointer(
  state: HeroGeometryState,
  x: number,
  y: number,
  timeMs: number,
  config: HeroGeometryConfig,
): void {
  state.pointerX = x;
  state.pointerY = y;
  state.isHovering = true;

  const distance = Math.hypot(x - state.lastSpawnX, y - state.lastSpawnY);
  const shouldSpawn =
    distance >= config.spawnDistance ||
    timeMs - state.lastSpawnMs >= config.spawnIntervalMs;

  if (!shouldSpawn) {
    return;
  }

  spawnGlyphCluster(state, x, y, timeMs, config);
  state.lastSpawnX = x;
  state.lastSpawnY = y;
  state.lastSpawnMs = timeMs;
}

export function advanceHeroGeometry(
  state: HeroGeometryState,
  deltaMs: number,
  config: HeroGeometryConfig,
): void {
  state.glyphs.forEach((glyph) => {
    glyph.ageMs += deltaMs;
  });
  state.glyphs = state.glyphs.filter(
    (glyph) => glyph.ageMs < config.glyphLifeMs,
  );
}

function spawnGlyphCluster(
  state: HeroGeometryState,
  x: number,
  y: number,
  timeMs: number,
  config: HeroGeometryConfig,
): void {
  const count = state.glyphs.length < 8 ? 4 : 3;

  for (let index = 0; index < count; index += 1) {
    const angle = timeMs * 0.002 + index * 2.36;
    const spread = index === 0 ? 0 : 38 + hashNumber(timeMs, index) * 34;
    const sides = HERO_POLYGON_SEQUENCE[
      state.sequenceIndex % HERO_POLYGON_SEQUENCE.length
    ];

    state.glyphs.push({
      ageMs: 0,
      birthMs: timeMs,
      cx: x + Math.cos(angle) * spread,
      cy: y + Math.sin(angle) * spread * 0.72,
      radius: 26 + hashNumber(index, timeMs) * 34,
      rotation: angle * 0.5,
      sides,
    });
    state.sequenceIndex += 1;
  }

  if (state.glyphs.length > config.maxGlyphs) {
    state.glyphs.splice(0, state.glyphs.length - config.maxGlyphs);
  }
}
