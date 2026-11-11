import styles from "@/components/ui/PillLink.module.css";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

export interface PillLinkProps {
  readonly children: string;
  readonly href: string;
  readonly icon?: "calendar" | "file" | "globe";
  readonly size?: "heroPrimary" | "heroSecondary" | "nav";
  readonly variant: "primary" | "secondary";
}

interface PillIconProps {
  readonly icon: "calendar" | "file" | "globe";
}

function PillIcon({ icon }: PillIconProps) {
  if (icon === "globe") {
    return (
      <svg
        aria-hidden="true"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    );
  }

  if (icon === "calendar") {
    return (
      <svg
        aria-hidden="true"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

export default function PillLink({
  children,
  href,
  icon,
  size,
  variant,
}: PillLinkProps) {
  const externalAttributes = getExternalLinkAttributes(href);
  const className = [
    styles.link,
    styles[variant],
    size ? styles[size] : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a href={href} className={className} {...externalAttributes}>
      {icon ? <PillIcon icon={icon} /> : null}
      <span className={styles.label}>{children}</span>
    </a>
  );
}
