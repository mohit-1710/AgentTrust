export interface LegalSection {
  readonly body: readonly string[];
  readonly title: string;
}

export interface LegalPageContent {
  readonly body: string;
  readonly sections: readonly LegalSection[];
  readonly title: string;
}

export const PRIVACY_PAGE: LegalPageContent = {
  title: "Privacy Policy",
  body:
    "AgentTrust keeps this website lightweight. This page explains the data surfaces used by the landing page, documentation, and cookie preference controls.",
  sections: [
    {
      title: "Cookie Preferences",
      body: [
        "The landing page stores your cookie choice in local browser storage so the preference banner does not keep reappearing.",
        "Marketing preferences are opt-in. Essential preferences are limited to site functionality.",
      ],
    },
    {
      title: "External Services",
      body: [
        "Documentation uses the configured native docs origin. Development defaults to localhost; outbound links may open GitHub or social platforms.",
        "Those services may process requests according to their own privacy terms.",
      ],
    },
    {
      title: "Contact",
      body: [
        "For privacy or data questions, use the repository issue tracker when accessible or the contact channel listed in the documentation.",
      ],
    },
  ],
} as const;

export const TERMS_PAGE: LegalPageContent = {
  title: "Terms of Service",
  body:
    "AgentTrust is an open-source developer project for gating AI-agent payments before settlement. These terms keep the public website clear and practical.",
  sections: [
    {
      title: "Developer Information",
      body: [
        "Website and documentation content is provided for builders evaluating the native NEAR AgentTrust prototype.",
        "The material is not financial, legal, or compliance advice.",
      ],
    },
    {
      title: "Open Source",
      body: [
        "AgentTrust source code is distributed under the license stated in the repository.",
        "Production use should include your own security, policy, and legal review.",
      ],
    },
    {
      title: "Availability",
      body: [
        "The landing page, docs, and testnet configuration may change as the project evolves.",
        "Contract accounts, source packages, and integration examples should be verified against the current documentation before deployment.",
      ],
    },
  ],
} as const;
