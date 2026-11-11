import styles from "@/components/CookieConsentSwitch.module.css";

export interface CookieConsentSwitchProps {
  readonly checked: boolean;
  readonly isDisabled?: boolean;
  readonly label: string;
  readonly onChange?: (isChecked: boolean) => void;
}

export default function CookieConsentSwitch({
  checked,
  isDisabled,
  label,
  onChange,
}: CookieConsentSwitchProps) {
  function handleClick() {
    if (!isDisabled && onChange) {
      onChange(!checked);
    }
  }

  return (
    <button
      className={styles.switch}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={isDisabled}
      data-disabled={isDisabled ? "true" : "false"}
      data-state={checked ? "checked" : "unchecked"}
      onClick={handleClick}
    >
      <span className={styles.thumb} aria-hidden="true" />
      <span className={styles.screenReaderOnly}>{label}</span>
    </button>
  );
}
