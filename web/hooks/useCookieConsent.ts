import { useEffect, useState } from "react";

import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_STORAGE_KEY,
  type CookieDecision,
} from "@/data/cookieConsent";

interface StoredCookieConsent {
  readonly decision: CookieDecision;
  readonly marketing: boolean;
  readonly updatedAt: string;
}

interface UseCookieConsentResult {
  readonly handleAcceptAll: () => void;
  readonly handleClosePreferences: () => void;
  readonly handleManagePreferences: () => void;
  readonly handleRejectAll: () => void;
  readonly handleSavePreferences: () => void;
  readonly isPreferencesOpen: boolean;
  readonly isVisible: boolean;
  readonly marketing: boolean;
  readonly setMarketing: (isChecked: boolean) => void;
}

function hasStoredConsent() {
  const hasLocalConsent =
    window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) !== null;
  const hasCookieConsent = document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));

  return hasLocalConsent || hasCookieConsent;
}

function persistConsent(
  decision: CookieDecision,
  marketing: boolean,
) {
  const consent: StoredCookieConsent = {
    decision,
    marketing,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify(consent),
  );
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${decision}; max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent("agenttrust-cookie-consent", { detail: consent }),
  );
}

export function useCookieConsent(): UseCookieConsentResult {
  const [isVisible, setIsVisible] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(!hasStoredConsent());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isPreferencesOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPreferencesOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreferencesOpen]);

  function closeWithConsent(
    decision: CookieDecision,
    allowsMarketing: boolean,
  ) {
    persistConsent(decision, allowsMarketing);
    setIsVisible(false);
  }

  return {
    handleAcceptAll: () => closeWithConsent("accepted", true),
    handleClosePreferences: () => setIsPreferencesOpen(false),
    handleManagePreferences: () =>
      setIsPreferencesOpen((current) => !current),
    handleRejectAll: () => closeWithConsent("rejected", false),
    handleSavePreferences: () => closeWithConsent("custom", marketing),
    isPreferencesOpen,
    isVisible,
    marketing,
    setMarketing,
  };
}
