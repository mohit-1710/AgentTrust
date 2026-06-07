import PillLink from "@/components/ui/PillLink";
import styles from "@/components/EventsSection.module.css";
import { EVENTS_COPY, EVENTS_HEADING } from "@/data/events";

export default function EventsHeader() {
  return (
    <div className={styles.header}>
      <h2 id="events-title" className={styles.heading}>
        <span className={styles.lineMask}>
          <span data-events-heading>{EVENTS_HEADING}</span>
        </span>
      </h2>
      <div className={styles.summary}>
        <p data-events-copy className={styles.copy}>
          {EVENTS_COPY}
        </p>
        <div data-events-cta className={styles.ctaWrap}>
          <PillLink href="#events" icon="calendar" variant="primary">
            Events
          </PillLink>
        </div>
      </div>
    </div>
  );
}
