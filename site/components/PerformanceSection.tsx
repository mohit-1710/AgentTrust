import PerformanceScroll from "@/components/PerformanceScroll";
import styles from "@/components/PerformanceSection.module.css";
import {
  PERFORMANCE_HEADLINE,
  PERFORMANCE_SECTION_LABELS,
} from "@/data/performance";

export default function PerformanceSection() {
  return (
    <section
      id="performance"
      className={styles.section}
      aria-labelledby="performance-title"
    >
      <div className={styles.shell}>
        <div className={styles.spacer} aria-hidden="true" />
        <div className={styles.opener}>
          <div className={styles.labelColumn} aria-hidden="true">
            {PERFORMANCE_SECTION_LABELS.map((label) => (
              <span className={styles.openerLabel} key={label}>
                {label}
              </span>
            ))}
          </div>
          <h2 id="performance-title" className={styles.openerTitle}>
            <span className={styles.openerLine}>
              {PERFORMANCE_HEADLINE.firstLine}
            </span>
            <span className={styles.openerLine}>
              <span className={styles.openerIndent}>
                {PERFORMANCE_HEADLINE.secondPrefix}{" "}
                <em>{PERFORMANCE_HEADLINE.secondEmphasis}</em>{" "}
                {PERFORMANCE_HEADLINE.secondSuffix}
              </span>
            </span>
          </h2>
        </div>
        <PerformanceScroll />
      </div>
    </section>
  );
}
