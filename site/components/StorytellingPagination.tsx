import styles from "@/components/StorytellingSection.module.css";
import type { StoryPanel } from "@/types/storytelling";

interface StorytellingPaginationProps {
  readonly activeIndex: number;
  readonly onSelectStory: (index: number) => void;
  readonly panels: readonly StoryPanel[];
}

export default function StorytellingPagination({
  activeIndex,
  onSelectStory,
  panels,
}: StorytellingPaginationProps) {
  return (
    <div className={styles.pagination} aria-label="Trust stack chapters">
      {panels.map((panel, index) => {
        const isActive = index === activeIndex;
        const className = isActive
          ? `${styles.chapterButton} ${styles.chapterButtonActive}`
          : styles.chapterButton;

        return (
          <button
            type="button"
            className={className}
            key={panel.title}
            onClick={() => onSelectStory(index)}
            aria-current={isActive ? "step" : undefined}
            data-story-chapter
          >
            <span className={styles.chapterNumber}>{index + 1}</span>
            <span className={styles.chapterRule} aria-hidden="true" />
            <span className={styles.chapterLabel}>{panel.title}</span>
          </button>
        );
      })}
    </div>
  );
}
