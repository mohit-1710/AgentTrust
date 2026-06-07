import styles from "@/components/StorytellingSection.module.css";
import MonadBenchmarkVisual from "@/components/MonadBenchmarkVisual";
import type { StoryPanel } from "@/types/storytelling";

interface StorytellingGraphicProps {
  readonly activeIndex: number;
  readonly panels: readonly StoryPanel[];
}

export default function StorytellingGraphic({
  activeIndex,
  panels,
}: StorytellingGraphicProps) {
  return (
    <div className={styles.graphics} aria-hidden="true" data-story-graphics>
      <div className={styles.gridFade} />
      {panels.map((panel, index) => {
        const className =
          index === activeIndex
            ? `${styles.visualPanel} ${styles.visualPanelActive}`
            : styles.visualPanel;

        return (
          <div className={className} data-story-visual-panel key={panel.title}>
            <div className={styles.visualMotionLayer} data-story-motion-layer>
              <span className={styles.visualDiagramLayer} data-story-diagram-layer>
                <MonadBenchmarkVisual
                  isActive={index === activeIndex}
                  kind={panel.visual}
                />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
