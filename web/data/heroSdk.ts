import { PUBLIC_LINKS } from "@/data/links";
export interface HeroSdkLink {
  readonly href: string; readonly icon: "github" | "package"; readonly label: string; readonly meta: string;
}
export interface HeroTerminalLine {
  readonly prompt?: string; readonly text: string; readonly tone: "accent" | "default" | "muted" | "success";
}
export const HERO_SDK_COMMAND = ". scripts/env.sh && pnpm check:fast";
export const HERO_SDK_COPY = {
  eyebrow: "Native development kit",
  title: "Inspect the payment boundary.",
  body: "From a prepared checkout, run the pure checks. The runtime runbook separates compiled code from observed native receipts.",
  commandLabel: "Copy local check command", copiedLabel: "Copied", terminalTitle: "native-payment-flow · illustration",
} as const;
export const HERO_SDK_LINKS: readonly HeroSdkLink[] = [
  { href: PUBLIC_LINKS.sdkSource, icon: "package", label: "SDK source", meta: "Local package · unpublished" },
  { href: PUBLIC_LINKS.github, icon: "github", label: "GitHub", meta: "mohit-1710/AgentTrust" },
];
export const HERO_TERMINAL_LINES: readonly HeroTerminalLine[] = [
  { text: "Illustrative flow — not a recorded transaction", tone: "muted" },
  { text: "request       invoice CSV + stable payment ID", tone: "default" },
  { text: "quote         supplier-signed exact request", tone: "default" },
  { text: "admission     owner policy + capability checks", tone: "accent" },
  { text: "dispatch      reserve → native NEAR transfer", tone: "default" },
  { text: "settlement    wait for final payment state", tone: "accent" },
  { text: "output        check the returned audit report", tone: "default" },
];
