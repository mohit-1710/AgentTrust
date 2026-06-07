import FooterBottom from "@/components/FooterBottom";
import FooterLinks from "@/components/FooterLinks";
import NewsletterSignup from "@/components/NewsletterSignup";

import styles from "@/components/FooterSection.module.css";

export default function FooterSection() {
  return (
    <footer id="footer" className={styles.footer}>
      <div className={styles.spacer} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.topRow}>
          <NewsletterSignup />
          <FooterLinks />
        </div>
        <FooterBottom />
      </div>
    </footer>
  );
}
