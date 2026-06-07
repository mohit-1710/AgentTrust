import Link from "next/link";
import AgentTrustLogo from "@/components/AgentTrustLogo";
import { PUBLIC_LINKS } from "@/data/links";

import styles from "@/app/blog/blog.module.css";

export default function BlogTopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <div className={styles.brand}>
          <AgentTrustLogo href="/" />
        </div>
        <nav className={styles.topbarLinks} aria-label="Blog primary navigation">
          <Link className={styles.topbarLink} href="/">
            Home
          </Link>
          <Link
            className={`${styles.topbarLink} ${styles.topbarLinkActive}`}
            href={PUBLIC_LINKS.blog}
          >
            Blog
          </Link>
          <a
            className={styles.topbarLink}
            href={PUBLIC_LINKS.docs}
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </nav>
      </div>
    </header>
  );
}
