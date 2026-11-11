import { FOOTER_LINK_GROUPS } from "@/data/footer";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

import styles from "@/components/FooterLinks.module.css";

export default function FooterLinks() {
  return (
    <nav className={styles.links} aria-label="Footer">
      {FOOTER_LINK_GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <h3 className={styles.title}>{group.title}</h3>
          <ul className={styles.list}>
            {group.links.map((link) => {
              const externalAttributes = getExternalLinkAttributes(link.href);

              return (
                <li key={link.label}>
                  <a
                    className={styles.link}
                    href={link.href}
                    {...externalAttributes}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
