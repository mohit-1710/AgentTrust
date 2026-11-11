import Image from "next/image";
import { forwardRef } from "react";
import styles from "@/components/EventFollower.module.css";
import type { EventItem } from "@/data/events";

interface EventFollowerProps {
  readonly event: EventItem | null;
}

const EventFollower = forwardRef<HTMLDivElement, EventFollowerProps>(
  function EventFollower({ event }, ref) {
    return (
      <div ref={ref} className={styles.follower} aria-hidden="true">
        <div className={styles.inner}>
          {event ? (
            <Image
              alt=""
              className={styles.image}
              height={320}
              src={event.imageSrc}
              width={320}
            />
          ) : null}
          <div className={styles.scrim}>
            <span>View Event</span>
          </div>
        </div>
      </div>
    );
  },
);

export default EventFollower;
