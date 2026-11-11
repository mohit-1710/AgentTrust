import type { Metadata } from "next";
import FooterSection from "@/components/FooterSection";
import TopNav from "@/components/TopNav";
import { PRIVACY_PAGE } from "@/data/legal";
import { PUBLIC_LINKS } from "@/data/links";

import styles from "@/app/legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | AgentTrust",
  alternates: {
    canonical: PUBLIC_LINKS.privacy,
  },
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <TopNav />
      <main className={styles.main} aria-label="AgentTrust privacy policy">
        <article className={styles.article}>
          <p className={styles.kicker}>Legal</p>
          <h1 className={styles.title}>{PRIVACY_PAGE.title}</h1>
          <p className={styles.body}>{PRIVACY_PAGE.body}</p>
          <div className={styles.sections}>
            {PRIVACY_PAGE.sections.map((section) => (
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
