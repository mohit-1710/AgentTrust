import TrilemmaScroll from "@/components/TrilemmaScroll";
import styles from "@/components/TrilemmaSection.module.css";

export default function TrilemmaSection() {
  return (
    <section
      id="trilemma"
      className={styles.section}
      aria-labelledby="trilemma-title"
    >
      <h2 id="trilemma-title" className={styles.visuallyHidden}>
        The Trilemma
      </h2>
      <TrilemmaScroll />
    </section>
  );
}
