import styles from "@/components/TrilemmaGlyph.module.css";
import { TRILEMMA_COPY } from "@/data/trilemma";

const PILLAR_POINTS = [
  { x: 560, y: 260 },
  { x: 292, y: 805 },
  { x: 828, y: 805 },
] as const;

export default function TrilemmaGlyph() {
  return (
    <svg
      aria-hidden="true"
      className={styles.glyph}
      viewBox="0 0 1120 1200"
      preserveAspectRatio="xMidYMid meet"
      data-trilemma-glyph
    >
      <path
        className={styles.faintEdge}
        d="M560 260 L292 805 L828 805 Z"
        data-trilemma-draw
      />
      <path
        className={styles.accentEdge}
        d="M560 416 L414 714 L706 714 Z"
        data-trilemma-draw
      />
      <path className={styles.webLine} d="M560 260 C560 138 560 92 560 40" />
      <path className={styles.webLine} d="M292 805 C166 842 96 898 40 1014" />
      <path className={styles.webLine} d="M828 805 C954 842 1024 898 1080 1014" />
      <path className={styles.webLine} d="M560 260 C396 414 262 476 90 452" />
      <path className={styles.webLine} d="M560 260 C724 414 858 476 1030 452" />
      <path className={styles.webLine} d="M292 805 C442 910 682 910 828 805" />
      <circle className={styles.coreDot} cx="560" cy="612" r="18" />
      {PILLAR_POINTS.map((point, index) => {
        const pillar = TRILEMMA_COPY.pillars[index];

        return (
          <g
            className={styles.node}
            data-trilemma-node
            key={pillar.label}
            transform={`translate(${point.x} ${point.y})`}
          >
            <circle className={styles.nodeRing} r="74" />
            <circle className={styles.nodeCore} r="30" />
            <text className={styles.nodeLabel} y="118" textAnchor="middle">
              {pillar.label}
            </text>
            <text className={styles.nodeCaption} y="148" textAnchor="middle">
              {pillar.caption}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
