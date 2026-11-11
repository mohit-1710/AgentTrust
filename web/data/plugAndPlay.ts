import { PUBLIC_LINKS } from "@/data/links";

export interface PlugChipRow {
  readonly duration: string;
  readonly labels: readonly string[];
  readonly offset: string;
  readonly reverse?: boolean;
}

export interface PlugCopySegment {
  readonly isDim?: boolean;
  readonly text: string;
}

export const PLUG_SECTION_TITLE = "Plug and play.";

export const PLUG_COPY: readonly PlugCopySegment[] = [
  { text: "Use AgentTrust where agents already pay. " },
  { text: "The SDK gives apps one verification path while adapters handle route-specific wire formats.", isDim: true },
] as const;

export const PLUG_CTA = {
  href: PUBLIC_LINKS.docsQuickstart,
  label: "Check Integration Briefing",
} as const;

export const PLUG_CHIP_ROWS: readonly PlugChipRow[] = [
  {
    duration: "42s",
    offset: "-4vw",
    labels: [
      "Identity",
      "Policy",
      "Feedback",
      "SERVICE Signature",
      "Gate Decision",
      "SPL Transfer",
      "Receipt",
    ],
  },
  {
    duration: "48s",
    offset: "-18vw",
    reverse: true,
    labels: [
      "SDK",
      "Verifier",
      "Replay Cache",
      "Proof Validator",
      "Policy Route",
      "Audit Trail",
      "Devnet",
    ],
  },
  {
    duration: "44s",
    offset: "-10vw",
    labels: [
      "Pay.sh",
      "Dexter",
      "atxp_ai",
      "MCPay",
      "Adapter",
      "Route",
      "Atomic Tx",
    ],
  },
] as const;
