import ExploreContent from "@/components/ExploreContent";
import styles from "@/components/ExploreSection.module.css";

export default function ExploreSection() {
  return (
    <section id="explore" className={styles.section} aria-labelledby="explore-title">
      <div className={styles.spacer} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.background} aria-hidden="true" />
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.panel}>
          <h2 id="explore-title" className={styles.visuallyHidden}>
            Explore AgentTrust
          </h2>
          <ExploreContent />
        </div>
      </div>
    </section>
  );
}
