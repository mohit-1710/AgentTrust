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
  "Live on Monad testnet · ERC-8004 reputation gate · 20 Foundry tests";

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
    { text: "Monad." },
  ],
];

export const HERO_HEADLINE =
  "The trust layer for AI-agent payments on Monad.";

export const HERO_BODY =
  "AgentTrust is the non-custodial reputation firewall for AI-agent payments on Monad. It reads a payee's on-chain ERC-8004 reputation and the payer's spending policy, then allows or blocks each x402 USDC payment before it settles.";

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
