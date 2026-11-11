import BenchmarkStatement from "@/components/BenchmarkStatement";
import styles from "@/components/BenchmarkSection.module.css";
import {
  BENCHMARK_TITLE,
  BENCHMARK_TITLE_LINES,
} from "@/data/benchmark";

export default function BenchmarkSection() {
  return (
    <section
      id="benchmark"
      className={styles.section}
      aria-labelledby="benchmark-title"
    >
      <div className={styles.shell}>
        <div className={styles.spacer} aria-hidden="true" />
        <BenchmarkStatement
          lines={BENCHMARK_TITLE_LINES}
          title={BENCHMARK_TITLE}
        />
      </div>
    </section>
  );
}
