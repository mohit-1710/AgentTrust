import ProgramsContent from "@/components/ProgramsContent";
import styles from "@/components/ProgramsSection.module.css";
import { PROGRAMS_SECTION_ID } from "@/data/programs";

export default function ProgramsSection() {
  return (
    <section
      id={PROGRAMS_SECTION_ID}
      className={styles.section}
      aria-labelledby="programs-title"
    >
      <div className={styles.shell}>
        <div className={styles.spacer} aria-hidden="true" />
        <ProgramsContent />
      </div>
    </section>
  );
}
