"use client";

import { useId } from "react";
import { NEWSLETTER_CONTENT } from "@/data/footer";
import styles from "@/components/NewsletterSignup.module.css";

/** The inherited visual form has no subscription backend. Never report a saved address. */
export default function NewsletterSignup() {
  const emailId = useId();
  const helperId = useId();
  return (
    <section className={styles.panel} aria-labelledby="newsletter-title">
      <div className={styles.copy}>
        <h2 id="newsletter-title" className={styles.title}>{NEWSLETTER_CONTENT.title}</h2>
        <p className={styles.body}>{NEWSLETTER_CONTENT.body}</p>
      </div>
      <div className={styles.form}>
        <label className={styles.label} htmlFor={emailId}>Email</label>
        <div className={styles.controlRow}>
          <input id={emailId} className={styles.input} type="email" disabled
            placeholder="Subscriptions unavailable" aria-describedby={helperId} />
          <button className={styles.button} type="button" disabled>
            <MailIcon /><span>Unavailable</span>
          </button>
        </div>
        <p id={helperId} className={styles.helper}>{NEWSLETTER_CONTENT.helper}</p>
      </div>
    </section>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className={styles.icon} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
