export type CookieDecision = "accepted" | "custom" | "rejected";

export const COOKIE_CONSENT_STORAGE_KEY = "agenttrust-cookie-consent";
export const COOKIE_CONSENT_COOKIE_NAME = "agenttrust_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const COOKIE_CONSENT_COPY = {
  title: "We value your privacy.",
  body: "This site uses cookies to improve your browsing experience, analyze site traffic, and show personalized content.",
  accept: "Accept All",
  reject: "Reject All",
  manage: "Manage Preferences",
  save: "Save Settings",
  settingsTitle: "Privacy Settings",
  settingsBody:
    "Customize your privacy settings here. You can choose which types of cookies and tracking technologies to enable.",
  essential: "Essential",
  essentialDescription: "Essential for core site functionality.",
  marketing: "Marketing",
  marketingDescription: "Marketing and analytics tracking.",
} as const;
