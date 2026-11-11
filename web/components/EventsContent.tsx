"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import EventFollower from "@/components/EventFollower";
import EventMobileCard from "@/components/EventMobileCard";
import EventRow from "@/components/EventRow";
import EventsHeader from "@/components/EventsHeader";
import tableStyles from "@/components/EventsTable.module.css";
import { EVENTS } from "@/data/events";
import type { EventItem } from "@/data/events";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { createEventFollowerMotion } from "@/lib/animations/eventFollower";
import { createEventsReveal } from "@/lib/animations/eventsReveal";

const TABLE_COLUMNS = ["Date", "Event", "Location", "Description"] as const;

export default function EventsContent() {
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const isReducedMotion = useReducedMotion();
  const followerRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<ReturnType<typeof createEventFollowerMotion> | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const follower = followerRef.current;

      if (!root) {
        return;
      }

      const cleanupReveal = createEventsReveal({ isReducedMotion, root });
      motionRef.current = follower
        ? createEventFollowerMotion({ follower, isReducedMotion })
        : null;

      return () => {
        cleanupReveal();
        motionRef.current?.kill();
        motionRef.current = null;
      };
    },
    { dependencies: [isReducedMotion], revertOnUpdate: true, scope: rootRef },
  );

  function handleRowEnter(
    event: EventItem,
    clientX?: number,
    clientY?: number,
  ): void {
    setActiveEvent(event);

    if (clientX === undefined || clientY === undefined) {
      return;
    }

    motionRef.current?.moveTo(clientX, clientY);
    motionRef.current?.show();
  }

  function handleRowLeave(): void {
    setActiveEvent(null);
    motionRef.current?.hide();
  }

  function handleRowMove(clientX: number, clientY: number): void {
    motionRef.current?.moveTo(clientX, clientY);
  }

  return (
    <div ref={rootRef} className={tableStyles.content}>
      <EventsHeader />
      <div className={tableStyles.tableWrap}>
        <div className={tableStyles.tableHeader} aria-hidden="true">
          {TABLE_COLUMNS.map((column) => (
            <span className={tableStyles.tableHeading} key={column}>
              {column}
            </span>
          ))}
        </div>
        <div className={tableStyles.rows}>
          {EVENTS.map((event) => (
            <EventRow
              event={event}
              isDimmed={activeEvent !== null && activeEvent.event !== event.event}
              key={event.event}
              onEnter={handleRowEnter}
              onLeave={handleRowLeave}
              onMove={handleRowMove}
            />
          ))}
        </div>
        <EventFollower event={activeEvent} ref={followerRef} />
      </div>
      <div className={tableStyles.mobileCards}>
        {EVENTS.map((event) => (
          <EventMobileCard event={event} key={event.event} />
        ))}
      </div>
    </div>
  );
}
