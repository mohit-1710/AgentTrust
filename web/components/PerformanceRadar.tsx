import styles from "@/components/PerformanceRadar.module.css";

export default function PerformanceRadar() {
  return (
    <div
      className={styles.radar}
      aria-hidden="true"
      data-performance-radar
    >
      <div className={styles.radarGlow} />
      <svg className={styles.radarSvg} viewBox="0 0 360 360" role="img">
        <circle className={styles.radarRingSoft} cx="180" cy="180" r="150" />
        <circle className={styles.radarRingMid} cx="180" cy="180" r="105" />
        <circle className={styles.radarRingStrong} cx="180" cy="180" r="58" />
        <path className={styles.radarSpoke} d="M180 238V350" />
        <path className={styles.radarTriangle} d="M180 122 230 209H130Z" />
        <circle className={styles.radarCore} cx="180" cy="180" r="13" />
      </svg>
    </div>
  );
}
