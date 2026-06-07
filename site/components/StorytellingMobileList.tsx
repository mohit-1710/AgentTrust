import PillLink from "@/components/ui/PillLink";
import styles from "@/components/StorytellingSection.module.css";
import type { StoryPanel } from "@/types/storytelling";

interface StorytellingMobileListProps {
  readonly panels: readonly StoryPanel[];
}

export default function StorytellingMobileList({
  panels,
}: StorytellingMobileListProps) {
  return (
    <div className={styles.mobileList}>
      {panels.map((panel, index) => (
        <article className={styles.mobileCard} key={panel.title}>
          <p className={styles.eyebrow}>{panel.eyebrow}</p>
          <h2 className={styles.mobileTitle}>{panel.title}</h2>
          <p className={styles.mobileBody}>{panel.body}</p>
          <PillLink href={panel.action.href} icon="file" variant="secondary">
            {panel.action.label}
          </PillLink>
          <span className={styles.mobileNumber} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        </article>
      ))}
    </div>
  );
}
