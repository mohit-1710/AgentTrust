import CookieConsentButton from "@/components/CookieConsentButton";
import CookieConsentSwitch from "@/components/CookieConsentSwitch";
import { COOKIE_CONSENT_COPY } from "@/data/cookieConsent";

import styles from "@/components/CookieConsentDialog.module.css";

export interface CookieConsentDialogProps {
  readonly id: string;
  readonly isMarketingEnabled: boolean;
  readonly onAcceptAll: () => void;
  readonly onClose: () => void;
  readonly onMarketingChange: (isChecked: boolean) => void;
  readonly onRejectAll: () => void;
  readonly onSave: () => void;
}

export default function CookieConsentDialog({
  id,
  isMarketingEnabled,
  onAcceptAll,
  onClose,
  onMarketingChange,
  onRejectAll,
  onSave,
}: CookieConsentDialogProps) {
  return (
    <>
      <div className={styles.overlay} aria-hidden="true" />
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
        aria-describedby="cookie-settings-description"
        id={id}
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="cookie-settings-title">
            {COOKIE_CONSENT_COPY.settingsTitle}
          </h2>
          <p className={styles.description} id="cookie-settings-description">
            {COOKIE_CONSENT_COPY.settingsBody}
          </p>
        </div>

        <div className={styles.settings}>
          <div>
            <div className={styles.settingHeader}>
              <h3 className={styles.settingTitle}>
                {COOKIE_CONSENT_COPY.essential}
              </h3>
              <CookieConsentSwitch
                checked
                isDisabled
                label="Toggle Essential"
              />
            </div>
            <p className={styles.settingDescription}>
              {COOKIE_CONSENT_COPY.essentialDescription}
            </p>
          </div>
          <div>
            <div className={styles.settingHeader}>
              <h3 className={styles.settingTitle}>
                {COOKIE_CONSENT_COPY.marketing}
              </h3>
              <CookieConsentSwitch
                checked={isMarketingEnabled}
                label="Toggle Marketing"
                onChange={onMarketingChange}
              />
            </div>
            <p className={styles.settingDescription}>
              {COOKIE_CONSENT_COPY.marketingDescription}
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.buttonPair}>
            <CookieConsentButton
              isStretch
              variant="secondary"
              onClick={onAcceptAll}
            >
              {COOKIE_CONSENT_COPY.accept}
            </CookieConsentButton>
            <CookieConsentButton
              isStretch
              variant="secondary"
              onClick={onRejectAll}
            >
              {COOKIE_CONSENT_COPY.reject}
            </CookieConsentButton>
          </div>
          <CookieConsentButton isStretch variant="primary" onClick={onSave}>
            {COOKIE_CONSENT_COPY.save}
          </CookieConsentButton>
        </div>

        <button
          className={styles.closeButton}
          type="button"
          aria-label="Close privacy settings"
          autoFocus
          onClick={onClose}
        >
          <svg
            className={styles.closeIcon}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
