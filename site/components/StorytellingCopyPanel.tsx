import PillLink from "@/components/ui/PillLink";
import styles from "@/components/StorytellingSection.module.css";
import type { StoryPanel } from "@/types/storytelling";

interface StorytellingCopyPanelProps {
  readonly index: number;
  readonly isActive: boolean;
  readonly panel: StoryPanel;
}

export default function StorytellingCopyPanel({
  index,
  isActive,
  panel,
}: StorytellingCopyPanelProps) {
  const className = isActive
    ? `${styles.copyPanel} ${styles.copyPanelActive}`
    : styles.copyPanel;

  return (
    <article
      className={className}
      aria-hidden={!isActive}
      data-story-copy-panel
      data-story-index={index}
    >
      <p className={styles.eyebrow} data-story-copy-eyebrow>
        {panel.eyebrow}
      </p>
      <h2 className={styles.title} data-story-copy-title>
        {panel.title}
      </h2>
      <p className={styles.body} data-story-copy-body>
        {panel.body}
      </p>
      <div
        className={styles.copyRule}
        aria-hidden="true"
        data-story-copy-rule
      />
      <div className={styles.action} data-story-copy-action>
        <PillLink href={panel.action.href} icon="file" variant="secondary">
          {panel.action.label}
        </PillLink>
      </div>
    </article>
  );
}
