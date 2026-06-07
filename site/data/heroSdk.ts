import { PUBLIC_LINKS } from "@/data/links";

export interface HeroSdkLink {
  readonly href: string;
  readonly icon: "github" | "package";
  readonly label: string;
  readonly meta: string;
}

export interface HeroTerminalLine {
  readonly prompt?: string;
  readonly text: string;
  readonly tone: "accent" | "default" | "muted" | "success";
}

export const HERO_SDK_COMMAND = "npm install @monad-agenttrust-sdk/sdk";

export const HERO_SDK_COPY = {
  eyebrow: "SDK Quickstart",
  title: "Wire trust checks in minutes.",
  body:
    "Create a viem-backed client, gate a payment against the payee's on-chain reputation and your policy, then settle the allowed transfer through x402.",
  commandLabel: "Copy SDK install command",
  copiedLabel: "Copied",
  terminalTitle: "agenttrust-gate",
} as const;

export const HERO_SDK_LINKS: readonly HeroSdkLink[] = [
  {
    href: PUBLIC_LINKS.npm,
    icon: "package",
    label: "NPM Package",
    meta: "@monad-agenttrust-sdk/sdk",
  },
  {
    href: PUBLIC_LINKS.github,
    icon: "github",
    label: "GitHub",
    meta: "mohit-1710/AgentTrust",
  },
];

export const HERO_TERMINAL_LINES: readonly HeroTerminalLine[] = [
  { prompt: "$", text: HERO_SDK_COMMAND, tone: "default" },
  {
    text: 'import { createAgentTrustClient, gate } from "@monad-agenttrust-sdk/sdk"',
    tone: "muted",
  },
  {
    text: "const client = createAgentTrustClient({ chainId: 10143 })",
    tone: "muted",
  },
  {
    text: "const decision = await gate(payer, payeeAgentId, amount)",
    tone: "muted",
  },
  { text: "reputation      averaged over trusted attestors", tone: "success" },
  { text: "policy          caps · velocity · kill-switch", tone: "success" },
  { text: "decision        ALLOW", tone: "accent" },
  { text: "settle          x402 USDC via molandak facilitator", tone: "accent" },
];
