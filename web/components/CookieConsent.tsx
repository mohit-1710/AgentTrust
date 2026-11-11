"use client";

import { useId } from "react";

import CookieConsentButton from "@/components/CookieConsentButton";
import CookieConsentDialog from "@/components/CookieConsentDialog";
import { COOKIE_CONSENT_COPY } from "@/data/cookieConsent";
import { useCookieConsent } from "@/hooks/useCookieConsent";

import styles from "@/components/CookieConsent.module.css";

export default function CookieConsent() {
  const preferencesId = useId();
  const consent = useCookieConsent();

  if (!consent.isVisible) {
    return null;
  }

  return (
    <>
      <aside
        className={styles.banner}
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-body"
      >
        <div className={styles.copy}>
          <h2 className={styles.title} id="cookie-consent-title">
            {COOKIE_CONSENT_COPY.title}
          </h2>
          <p className={styles.body} id="cookie-consent-body">
            {COOKIE_CONSENT_COPY.body}
          </p>
        </div>

        <div className={styles.actions}>
          <div className={styles.decisionGroup}>
            <CookieConsentButton
              variant="primary"
              onClick={consent.handleAcceptAll}
            >
              {COOKIE_CONSENT_COPY.accept}
            </CookieConsentButton>
            <CookieConsentButton
              variant="secondary"
              onClick={consent.handleRejectAll}
            >
              {COOKIE_CONSENT_COPY.reject}
            </CookieConsentButton>
          </div>
          <CookieConsentButton
            variant="ghost"
            ariaControls={preferencesId}
            ariaExpanded={consent.isPreferencesOpen}
            onClick={consent.handleManagePreferences}
          >
            {COOKIE_CONSENT_COPY.manage}
          </CookieConsentButton>
        </div>
      </aside>

      {consent.isPreferencesOpen ? (
        <CookieConsentDialog
          id={preferencesId}
          isMarketingEnabled={consent.marketing}
          onAcceptAll={consent.handleAcceptAll}
          onClose={consent.handleClosePreferences}
          onMarketingChange={consent.setMarketing}
          onRejectAll={consent.handleRejectAll}
          onSave={consent.handleSavePreferences}
        />
      ) : null}
    </>
  );
}
