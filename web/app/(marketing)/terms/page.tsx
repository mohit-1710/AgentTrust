import type { Metadata } from "next";
import FooterSection from "@/components/FooterSection";
import TopNav from "@/components/TopNav";
import { PUBLIC_LINKS } from "@/data/links";
import { TERMS_PAGE } from "@/data/legal";

import styles from "@/app/legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | AgentTrust",
  alternates: {
    canonical: PUBLIC_LINKS.terms,
  },
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <TopNav />
      <main className={styles.main} aria-label="AgentTrust terms of service">
        <article className={styles.article}>
          <p className={styles.kicker}>Legal</p>
          <h1 className={styles.title}>{TERMS_PAGE.title}</h1>
          <p className={styles.body}>{TERMS_PAGE.body}</p>
          <div className={styles.sections}>
            {TERMS_PAGE.sections.map((section) => (
              <section className={styles.section} key={section.title}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <div className={styles.sectionBody}>
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <FooterSection />
    </div>
  );
}
