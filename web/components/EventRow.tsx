import type { MouseEvent } from "react";
import EventVisual from "@/components/EventVisual";
import styles from "@/components/EventRow.module.css";
import type { EventItem } from "@/data/events";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

interface EventRowProps {
  readonly event: EventItem;
  readonly isDimmed: boolean;
  readonly onEnter: (
    event: EventItem,
    clientX?: number,
    clientY?: number,
  ) => void;
  readonly onLeave: () => void;
  readonly onMove: (clientX: number, clientY: number) => void;
}

export default function EventRow({
  event,
  isDimmed,
  onEnter,
  onLeave,
  onMove,
}: EventRowProps) {
  const className = [styles.row, isDimmed ? styles.rowDimmed : ""]
    .filter(Boolean)
    .join(" ");
  const externalAttributes = getExternalLinkAttributes(event.href);

  function handleFocus(): void {
    onEnter(event);
  }

  function handleMouseEnter(mouseEvent: MouseEvent<HTMLAnchorElement>): void {
    onEnter(event, mouseEvent.clientX, mouseEvent.clientY);
  }

  function handleMouseMove(mouseEvent: MouseEvent<HTMLAnchorElement>): void {
    onMove(mouseEvent.clientX, mouseEvent.clientY);
  }

  return (
    <article className={className} data-events-row>
      <a
        className={styles.link}
        href={event.href}
        onBlur={onLeave}
        onFocus={handleFocus}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onLeave}
        onMouseMove={handleMouseMove}
        {...externalAttributes}
      >
        <div className={styles.date}>
          <p>{event.date}</p>
        </div>
        <div className={styles.event}>
          <h3>{event.event}</h3>
        </div>
        <div className={styles.location}>
          <p>{event.location}</p>
        </div>
        <div className={styles.description}>
          <p>{event.description}</p>
        </div>
        <span className={styles.visualSource} aria-hidden="true">
          <EventVisual event={event} />
        </span>
      </a>
    </article>
  );
}
