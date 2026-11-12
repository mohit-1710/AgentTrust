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
  title: "AgentTrust build notes",
  body: "Implementation notes, SDK progress, and native payment checks.",
  helper: "Email subscriptions are unavailable. Read the build notes on the blog.",
};

export const FOOTER_LINK_GROUPS: readonly FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { href: "#home", label: "Home" },
      { href: "#trust-stack", label: "Trust Stack" },
      { href: "#performance", label: "Payment Model" },
      { href: "#network", label: "Network" },
      { href: PUBLIC_LINKS.blog, label: "Blog" },
    ],
  },
  {
    title: "Build",
    links: [
      { href: PUBLIC_LINKS.docs, label: "Documentation" },
      { href: PUBLIC_LINKS.docsQuickstart, label: "Quickstart" },
      { href: PUBLIC_LINKS.docsHttp402, label: "HTTP 402 Flow" },
      { href: PUBLIC_LINKS.docsAuditExample, label: "Audit Capability" },
    ],
  },
  {
    title: "Verification",
    links: [
      { href: "#benchmark", label: "Spending Boundary" },
      { href: PUBLIC_LINKS.docsVerification, label: "Checks and Gaps" },
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
  { href: PUBLIC_LINKS.blogFeed, icon: "rss", label: "RSS" },
];
