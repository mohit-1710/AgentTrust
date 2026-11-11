import FloatingChipField from "@/components/FloatingChipField";
import PlugAndPlayContent from "@/components/PlugAndPlayContent";
import styles from "@/components/PlugAndPlaySection.module.css";

export default function PlugAndPlaySection() {
  return (
    <section
      id="plug-and-play"
      className={styles.section}
      aria-labelledby="plug-and-play-title"
    >
      <div className={styles.topSpacer} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.panel}>
          <FloatingChipField />
          <PlugAndPlayContent />
          <div className={styles.glow} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
