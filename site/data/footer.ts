import { PUBLIC_LINKS, SOCIAL_LINKS } from "@/data/links";

export interface FooterLink {
  readonly href: string;
  readonly label: string;
}

export interface FooterLinkGroup {
  readonly title: string;
  readonly links: readonly FooterLink[];
}

export type FooterUtilityLink = FooterLink;

export interface FooterSocialLink extends FooterLink {
  readonly icon: "discord" | "x" | "rss";
}

export const NEWSLETTER_CONTENT = {
  title: "Subscribe to AgentTrust Notes",
  body: "Proof updates, SDK notes, and payment-risk integration logs.",
  helper: "Monthly field notes for builders shipping agent payments.",
};

export const FOOTER_LINK_GROUPS: readonly FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { href: "#home", label: "Home" },
      { href: "#trust-stack", label: "Trust Stack" },
      { href: "#performance", label: "Performance" },
      { href: "#network", label: "Network" },
      { href: PUBLIC_LINKS.blog, label: "Blog" },
    ],
  },
  {
    title: "Build",
    links: [
      { href: PUBLIC_LINKS.docs, label: "Documentation" },
      { href: PUBLIC_LINKS.docsQuickstart, label: "Quickstart" },
      { href: PUBLIC_LINKS.docsFacilitatorAdapters, label: "Route Adapters" },
      { href: PUBLIC_LINKS.docsPayShAdapter, label: "Live Adapter Example" },
    ],
  },
  {
    title: "Proofs",
    links: [
      { href: "#benchmark", label: "Benchmark" },
      { href: PUBLIC_LINKS.docsFormalVerification, label: "Kani Checks" },
      { href: PUBLIC_LINKS.docsChangelog, label: "Field Notes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: PUBLIC_LINKS.githubLicense, label: "MIT License" },
      { href: PUBLIC_LINKS.privacy, label: "Privacy" },
      { href: PUBLIC_LINKS.terms, label: "Terms" },
    ],
  },
];

export const FOOTER_UTILITY_LINKS: readonly FooterUtilityLink[] = [
  { href: PUBLIC_LINKS.privacy, label: "Privacy Policy" },
  { href: PUBLIC_LINKS.terms, label: "Terms of Service" },
];

export const FOOTER_SOCIAL_LINKS: readonly FooterSocialLink[] = [
  { href: SOCIAL_LINKS.x, icon: "x", label: "X" },
  { href: SOCIAL_LINKS.discord, icon: "discord", label: "Discord" },
];
