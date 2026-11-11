import type { CSSProperties } from "react";
import styles from "@/components/PerformanceBars.module.css";
import { PERFORMANCE_BARS } from "@/data/performance";

interface BarStyle extends CSSProperties {
  "--bar-height": number;
}

export default function PerformanceBars() {
  return (
    <div className={styles.bars} aria-hidden="true">
      {PERFORMANCE_BARS.map((bar, index) => {
        const style: BarStyle = { "--bar-height": bar.height };

        return (
          <span
            className={styles.bar}
            data-performance-bar
            key={`${bar.height}-${index}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
