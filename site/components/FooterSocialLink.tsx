import type { FooterSocialLink as FooterSocialLinkData } from "@/data/footer";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

import styles from "@/components/FooterBottom.module.css";

const SOCIAL_ICON_PATHS = {
  discord:
    "M19.36 5.04A17.2 17.2 0 0 0 15.11 3.7a.06.06 0 0 0-.07.03c-.18.32-.39.73-.53 1.06a15.93 15.93 0 0 0-4.78 0 10.8 10.8 0 0 0-.54-1.06.07.07 0 0 0-.07-.03c-1.48.25-2.9.7-4.25 1.34a.05.05 0 0 0-.02.02C2.17 9.06 1.43 12.96 1.8 16.8c0 .02.01.04.03.05a17.36 17.36 0 0 0 5.22 2.64c.03.01.06 0 .08-.03.4-.55.76-1.13 1.07-1.75.02-.04 0-.08-.04-.1a11.48 11.48 0 0 1-1.64-.78c-.04-.02-.04-.08 0-.1.11-.08.22-.17.33-.25.02-.02.05-.02.08-.01a12.33 12.33 0 0 0 10.16 0c.03-.01.06-.01.08.01.11.09.22.17.33.25.04.03.04.08 0 .1-.52.31-1.07.57-1.64.78-.04.01-.06.06-.04.1.32.62.68 1.2 1.07 1.75.02.03.05.04.08.03a17.3 17.3 0 0 0 5.23-2.64.07.07 0 0 0 .03-.05c.45-4.44-.74-8.3-2.83-11.74a.05.05 0 0 0-.03-.02ZM8.62 14.46c-1.02 0-1.86-.94-1.86-2.1s.82-2.1 1.86-2.1c1.05 0 1.88.95 1.86 2.1 0 1.16-.83 2.1-1.86 2.1Zm6.79 0c-1.02 0-1.86-.94-1.86-2.1s.82-2.1 1.86-2.1c1.05 0 1.88.95 1.86 2.1 0 1.16-.82 2.1-1.86 2.1Z",
  x:
    "M18.3263 1.90393H21.6998L14.3297 10.3274L23 21.7899H16.2112L10.894 14.838L4.80995 21.7899H1.43443L9.31743 12.78L1 1.90393H7.96111L12.7674 8.25826L18.3263 1.90393ZM17.1423 19.7707H19.0116L6.94539 3.81706H4.93946L17.1423 19.7707Z",
  rss:
    "M5 5C13.84 5 21 12.16 21 21H17.5C17.5 14.1 11.9 8.5 5 8.5V5ZM5 11.5C10.25 11.5 14.5 15.75 14.5 21H11C11 17.69 8.31 15 5 15V11.5ZM5 18C6.66 18 8 19.34 8 21C8 22.66 6.66 24 5 24C3.34 24 2 22.66 2 21C2 19.34 3.34 18 5 18Z",
} as const;

export interface FooterSocialLinkProps {
  readonly link: FooterSocialLinkData;
}

export default function FooterSocialLink({ link }: FooterSocialLinkProps) {
  const externalAttributes = getExternalLinkAttributes(link.href);

  return (
    <a
      aria-label={link.label}
      className={styles.socialLink}
      data-icon={link.icon}
      href={link.href}
      {...externalAttributes}
    >
      <svg aria-hidden="true" className={styles.socialIcon} viewBox="0 0 24 24" fill="none">
        <path d={SOCIAL_ICON_PATHS[link.icon]} fill="currentColor" />
      </svg>
    </a>
  );
}
