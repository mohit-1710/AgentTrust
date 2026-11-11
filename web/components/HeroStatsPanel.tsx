import { HERO_STATS } from "@/data/stats";
import styles from "@/components/Hero.module.css";

export default function HeroStatsPanel() {
  return (
    <aside className={styles.panel} aria-label="AgentTrust proofs">
      <dl className={styles.stats}>
        {HERO_STATS.map((stat) => (
          <div className={styles.stat} key={stat.label} data-hero-fade>
            <dt className={styles.statLabel}>{stat.label}</dt>
            <dd className={styles.statValue}>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
