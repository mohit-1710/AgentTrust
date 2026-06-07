import type { FooterUtilityLink } from "@/data/footer";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

import styles from "@/components/FooterBottom.module.css";

export interface FooterArrowLinkProps {
  readonly link: FooterUtilityLink;
}

export default function FooterArrowLink({ link }: FooterArrowLinkProps) {
  const externalAttributes = getExternalLinkAttributes(link.href);

  return (
    <a
      className={styles.arrowLink}
      href={link.href}
      {...externalAttributes}
    >
      <span>{link.label}</span>
      <svg aria-hidden="true" className={styles.arrowIcon} viewBox="0 0 24 24" fill="none">
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
      </svg>
    </a>
  );
}
