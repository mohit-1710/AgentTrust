import styles from "@/components/NetworkSignalRail.module.css";
import { NETWORK_SIGNALS } from "@/data/network";

export default function NetworkSignalRail() {
  return (
    <aside className={styles.rail} aria-label="Facilitator network signals">
      <div className={styles.connector} aria-hidden="true" />
      <div className={styles.cards}>
        {NETWORK_SIGNALS.map((signal) => (
          <article
            className={styles.card}
            data-network-card
            key={signal.eyebrow}
          >
            <p className={styles.eyebrow}>{signal.eyebrow}</p>
            <h3 className={styles.title}>{signal.title}</h3>
            <p className={styles.body}>{signal.body}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}
