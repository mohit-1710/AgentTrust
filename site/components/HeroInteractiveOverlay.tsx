"use client";

import styles from "@/components/HeroInteractiveOverlay.module.css";
import { useHeroInteractiveOverlay } from "@/hooks/useHeroInteractiveOverlay";

export default function HeroInteractiveOverlay() {
  const {
    canvasRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    surfaceRef,
  } = useHeroInteractiveOverlay();

  return (
    <div
      ref={surfaceRef}
      aria-hidden="true"
      className={styles.overlay}
      data-hero-interactive-overlay
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <canvas className={styles.canvas} ref={canvasRef} />
    </div>
  );
}
