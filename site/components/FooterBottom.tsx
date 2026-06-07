import FooterArrowLink from "@/components/FooterArrowLink";
import FooterSocialLink from "@/components/FooterSocialLink";
import { FOOTER_SOCIAL_LINKS, FOOTER_UTILITY_LINKS } from "@/data/footer";

import styles from "@/components/FooterBottom.module.css";

export default function FooterBottom() {
  return (
    <div className={styles.bottom}>
      <div className={styles.leftCluster}>
        <p className={styles.copyright}>(c) 2026 AgentTrust. MIT licensed.</p>
        <ul className={styles.utilityLinks} aria-label="Footer utility links">
          {FOOTER_UTILITY_LINKS.map((link) => (
            <li key={link.label}>
              <FooterArrowLink link={link} />
            </li>
          ))}
        </ul>
      </div>
      <ul className={styles.socialLinks} aria-label="Social links">
        {FOOTER_SOCIAL_LINKS.map((link) => (
          <li key={link.label}>
            <FooterSocialLink link={link} />
          </li>
        ))}
      </ul>
    </div>
  );
}
