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
  "Live on Solana devnet · 7 / 7 Kani proofs · 662 sub-checks";

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
    { text: "Solana." },
  ],
];

export const HERO_HEADLINE =
  "The trust layer for AI-agent payments on Solana.";

export const HERO_BODY =
  "AgentTrust completes Solana's ERC-8004 trust stack — three Anchor programs that gate every payment by counterparty identity, reputation, and capability validation. Drop-in for Pay.sh and the next x402 facilitator.";

export const HERO_ACTIONS: readonly HeroAction[] = [
  {
    icon: "globe",
    label: "Integrate SDK",
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
