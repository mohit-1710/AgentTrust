import NetworkScroll from "@/components/NetworkScroll";
import styles from "@/components/NetworkSection.module.css";
import {
  NETWORK_COPY,
  NETWORK_CTA,
  NETWORK_HEADLINE,
  NETWORK_LABELS,
} from "@/data/network";
import PillLink from "@/components/ui/PillLink";

export default function NetworkSection() {
  return (
    <section
      id="network"
      className={styles.section}
      aria-labelledby="network-title"
    >
      <div className={styles.inner}>
        <div className={styles.opener}>
          <div className={styles.copy}>
            <h2 id="network-title" className={styles.title}>
              <span>{NETWORK_HEADLINE.firstLine}</span>
              <span className={styles.indent}>
                {NETWORK_HEADLINE.secondLine}
              </span>
            </h2>
            <p className={styles.body}>
              {NETWORK_COPY.map((segment) => (
                <span
                  className={segment.isDim ? styles.dim : undefined}
                  key={segment.text}
                >
                  {segment.text}
                </span>
              ))}
            </p>
            <div className={styles.action}>
              <PillLink href={NETWORK_CTA.href} variant="secondary">
                {NETWORK_CTA.label}
              </PillLink>
            </div>
          </div>
          <div className={styles.labels}>
            {NETWORK_LABELS.map((label) => (
              <article className={styles.labelCard} key={label.text}>
                <span className={styles.label}>{label.text}</span>
                <span className={styles.labelCaption}>{label.caption}</span>
              </article>
            ))}
          </div>
        </div>
        <NetworkScroll />
      </div>
    </section>
  );
}
