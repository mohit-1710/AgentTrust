import EventVisual from "@/components/EventVisual";
import styles from "@/components/EventMobileCard.module.css";
import type { EventItem } from "@/data/events";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

interface EventMobileCardProps {
  readonly event: EventItem;
}

export default function EventMobileCard({ event }: EventMobileCardProps) {
  const externalAttributes = getExternalLinkAttributes(event.href);

  return (
    <article className={styles.card}>
      <a className={styles.link} href={event.href} {...externalAttributes}>
        <EventVisual event={event} />
        <div className={styles.content}>
          <p className={styles.date}>{event.date}</p>
          <h3 className={styles.title}>{event.event}</h3>
          <p className={styles.location}>{event.location}</p>
          <p className={styles.description}>{event.description}</p>
        </div>
      </a>
    </article>
  );
}
