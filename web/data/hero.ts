import { PUBLIC_LINKS } from "@/data/links";

export interface HeadlineWord {
  readonly text: string;
  readonly isEmphasized?: boolean;
}

export interface HeroAction {
  readonly icon: "file" | "globe";
  readonly label: string;
  readonly href: string;
  readonly variant: "primary" | "secondary";
}

export const HERO_FOUNDATION_LINE =
  "NEAR testnet payments verified · refund-gap proof pending";

export const HERO_HEADLINE_LINES: readonly (readonly HeadlineWord[])[] = [
  [
    { text: "The" },
    { text: "trust", isEmphasized: true },
    { text: "layer" },
  ],
  [
    { text: "for" },
    { text: "AI-agent" },
    { text: "payments" },
    { text: "on" },
    { text: "NEAR." },
  ],
];

export const HERO_HEADLINE =
  "The trust layer for AI-agent payments on NEAR.";

export const HERO_BODY =
  "Give an agent a spending limit and a list of permitted suppliers. AgentTrust checks signed invoices, capability evidence, and owner rules before reserving native NEAR for payment.";

export const HERO_ACTIONS: readonly HeroAction[] = [
  {
    icon: "globe",
    label: "Read the Quickstart",
    href: PUBLIC_LINKS.docsQuickstart,
    variant: "primary",
  },
  {
    icon: "file",
    label: "View on GitHub",
    href: PUBLIC_LINKS.github,
    variant: "secondary",
  },
];

export const HERO_MEDIA = {
  src: "/media/agenttrust-hero-loop.mp4",
  poster: "/media/agenttrust-hero-poster.png",
  label: "Abstract AgentTrust payment verification loop",
} as const;
