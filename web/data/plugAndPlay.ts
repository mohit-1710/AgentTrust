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

export const PLUG_SECTION_TITLE = "A bounded tool call.";

export const PLUG_COPY: readonly PlugCopySegment[] = [
  { text: "A local agent should ask for a service, not raw signing power. " },
  { text: "The six-tool local MCP keeps owner management separate and accepts a stable payment ID for every purchase.", isDim: true },
] as const;

export const PLUG_CTA = {
  href: PUBLIC_LINKS.docsQuickstart,
  label: "Read the Integration Guide",
} as const;

export const PLUG_CHIP_ROWS: readonly PlugChipRow[] = [
  {
    duration: "42s",
    offset: "-4vw",
    labels: [
      "Identity",
      "Policy",
      "Settlement",
      "Signed Invoice",
      "Gate Decision",
      "Native NEAR",
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
      "Stable Payment ID",
      "Fixture Validator",
      "Policy Route",
      "Audit Trail",
      "Testnet Scope",
    ],
  },
  {
    duration: "44s",
    offset: "-10vw",
    labels: [
      "invoice.audit.v1",
      "Issuer Scope",
      "Owner Trust",
      "Restricted Key",
      "Adapter",
      "Route",
      "Private Callback",
    ],
  },
] as const;
