import styles from "@/components/PerformanceStats.module.css";
import { PERFORMANCE_STATS } from "@/data/performance";

export default function PerformanceStats() {
  return (
    <dl className={styles.stats}>
      {PERFORMANCE_STATS.map((stat) => (
        <div className={styles.stat} key={stat.label}>
          <dt className={styles.statLabel}>{stat.label}</dt>
          <dd
            className={styles.statValue}
            data-count-decimals={stat.count?.decimals}
            data-count-from={stat.count?.from}
            data-count-suffix={stat.count?.suffix}
            data-count-target={stat.count?.target}
            data-performance-count={stat.count ? true : undefined}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
