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

export const HERO_SDK_COMMAND = "npm install @agenttrust-sdk/trustgate";

export const HERO_SDK_COPY = {
  eyebrow: "SDK Quickstart",
  title: "Wire trust checks in minutes.",
  body:
    "Run the demo, verify a SERVICE-signed challenge, and settle policy, transfer, and feedback together.",
  commandLabel: "Copy SDK install command",
  copiedLabel: "Copied",
  terminalTitle: "agenttrust-demo",
} as const;

export const HERO_SDK_LINKS: readonly HeroSdkLink[] = [
  {
    href: PUBLIC_LINKS.npm,
    icon: "package",
    label: "NPM Package",
    meta: "@agenttrust-sdk/trustgate",
  },
  {
    href: PUBLIC_LINKS.github,
    icon: "github",
    label: "GitHub",
    meta: "agenttrust-labs/agenttrust",
  },
];

export const HERO_TERMINAL_LINES: readonly HeroTerminalLine[] = [
  { prompt: "$", text: HERO_SDK_COMMAND, tone: "default" },
  {
    text: "pnpm --filter ./examples/pay-sh-demo dev",
    tone: "muted",
  },
  {
    text: "curl https://demo.agenttrust.tech/protected",
    tone: "muted",
  },
  { text: "adapter         PaySh.parseRequest -> VerifyContext", tone: "success" },
  { text: "policy          gate_payment returned Allow", tone: "accent" },
  { text: "challenge       SERVICE signature verified", tone: "success" },
  { text: "settlement      SPL transfer + emit_feedback, one tx", tone: "accent" },
];
