import styles from "@/components/CookieConsentButton.module.css";

export interface CookieConsentButtonProps {
  readonly ariaControls?: string;
  readonly ariaExpanded?: boolean;
  readonly children: string;
  readonly isStretch?: boolean;
  readonly onClick: () => void;
  readonly variant: "ghost" | "primary" | "secondary";
}

export default function CookieConsentButton({
  ariaControls,
  ariaExpanded,
  children,
  isStretch,
  onClick,
  variant,
}: CookieConsentButtonProps) {
  const className = [
    styles.button,
    styles[variant],
    isStretch ? styles.stretch : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      type="button"
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      onClick={onClick}
    >
      <span className={styles.label}>{children}</span>
    </button>
  );
}
