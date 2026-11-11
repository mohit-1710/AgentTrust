"use client";

import {
  useEffect,
  useRef,
  type PointerEvent,
  type RefObject,
} from "react";
import { HERO_GEOMETRY_CONFIG } from "@/data/heroGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { drawHeroGeometry } from "@/lib/heroGeometryDrawing";
import {
  advanceHeroGeometry,
  createHeroGeometryState,
  updateHeroGeometryPointer,
} from "@/lib/heroGeometryState";
import type { HeroGeometryState } from "@/types/heroGeometry";

const MAX_DPR = 1.5;

interface UseHeroInteractiveOverlayResult {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly handlePointerEnter: (event: PointerEvent<HTMLDivElement>) => void;
  readonly handlePointerLeave: () => void;
  readonly handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
}

export function useHeroInteractiveOverlay(): UseHeroInteractiveOverlayResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HeroGeometryState>(createHeroGeometryState());
  const lastFrameRef = useRef<number>(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !surface || !context) {
      return;
    }

    let frameId = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = surface.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (timeMs: number) => {
      const lastFrame = lastFrameRef.current || timeMs;
      const deltaMs = Math.min(timeMs - lastFrame, 48);
      lastFrameRef.current = timeMs;

      advanceHeroGeometry(
        stateRef.current,
        shouldReduceMotion ? Math.min(deltaMs, 16) : deltaMs,
        HERO_GEOMETRY_CONFIG,
      );
      drawHeroGeometry(
        context,
        width,
        height,
        stateRef.current,
        HERO_GEOMETRY_CONFIG,
        timeMs,
      );
      frameId = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(surface);
    resize();
    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [shouldReduceMotion]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateHeroGeometryPointer(
      stateRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top,
      performance.now(),
      HERO_GEOMETRY_CONFIG,
    );
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    stateRef.current.lastSpawnMs = 0;
    handlePointerMove(event);
  };

  const handlePointerLeave = () => {
    stateRef.current.isHovering = false;
  };

  return {
    canvasRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    surfaceRef,
  };
}
