"use client";

import { useId, useState, type FormEvent } from "react";

import { NEWSLETTER_CONTENT } from "@/data/footer";

import styles from "@/components/NewsletterSignup.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubmitStatus = "idle" | "error" | "success";

export default function NewsletterSignup() {
  const emailId = useId();
  const helperId = useId();
  const messageId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const hasError = status === "error";
  const hasSuccess = status === "success";
  const describedBy = hasError || hasSuccess ? `${helperId} ${messageId}` : helperId;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email.trim())) {
      setStatus("error");
      return;
    }

    setStatus("success");
  }

  return (
    <section className={styles.panel} aria-labelledby="newsletter-title">
      <div className={styles.copy}>
        <h2 id="newsletter-title" className={styles.title}>
          {NEWSLETTER_CONTENT.title}
        </h2>
        <p className={styles.body}>{NEWSLETTER_CONTENT.body}</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.label} htmlFor={emailId}>
          Email
        </label>
        <div className={styles.controlRow}>
          <input
            id={emailId}
            className={styles.input}
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            placeholder="you@example.com"
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status !== "idle") {
                setStatus("idle");
              }
            }}
          />
          <button className={styles.button} type="submit">
            <MailIcon />
            <span>Subscribe</span>
          </button>
        </div>
        <p id={helperId} className={styles.helper}>
          {NEWSLETTER_CONTENT.helper}
        </p>
        {hasError ? (
          <p id={messageId} className={styles.error}>
            Email must include an @ and a domain.
          </p>
        ) : null}
        {hasSuccess ? (
          <p id={messageId} className={styles.success}>
            You are on the list.
          </p>
        ) : null}
      </form>
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
