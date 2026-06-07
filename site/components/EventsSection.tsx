import EventsContent from "@/components/EventsContent";
import styles from "@/components/EventsSection.module.css";

export default function EventsSection() {
  return (
    <section id="events" className={styles.section} aria-labelledby="events-title">
      <div className={styles.spacer} aria-hidden="true" />
      <div className={styles.container}>
        <EventsContent />
      </div>
    </section>
  );
}
