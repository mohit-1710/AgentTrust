import PillLink from "@/components/ui/PillLink";
import styles from "@/components/MediaSection.module.css";
import { MEDIA_COPY, MEDIA_HEADING } from "@/data/media";

export default function MediaHeader() {
  return (
    <div className={styles.header}>
      <h2 id="media-title" className={styles.heading}>
        <span className={styles.lineMask}>
          <span data-media-heading>{MEDIA_HEADING}</span>
        </span>
      </h2>
      <div className={styles.summary}>
        <p className={styles.copy} data-media-copy>
          {MEDIA_COPY}
        </p>
        <div className={styles.ctaWrap} data-media-cta>
          <PillLink href="#media" icon="file" variant="primary">
            Read AgentTrust Media
          </PillLink>
        </div>
      </div>
    </div>
  );
}
