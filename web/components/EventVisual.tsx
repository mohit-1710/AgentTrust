import Image from "next/image";
import styles from "@/components/EventVisual.module.css";
import type { EventItem } from "@/data/events";

interface EventVisualProps {
  readonly event: EventItem;
}

export default function EventVisual({ event }: EventVisualProps) {
  return (
    <span className={styles.frame}>
      <Image
        alt={event.imageAlt}
        className={styles.image}
        height={320}
        src={event.imageSrc}
        width={320}
      />
      <span className={styles.overlay}>
        <span>View Event</span>
      </span>
    </span>
  );
}
