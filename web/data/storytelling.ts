import { PUBLIC_LINKS } from "@/data/links";
import type { StoryPanel } from "@/types/storytelling";

export const STORYTELLING_SECTION_ID = "trust-stack";

export const STORYTELLING_PANELS: readonly StoryPanel[] = [
  {
    eyebrow: "01 / Identity",
    title: "Know the counterparty first",
    body: "Bind a supplier account, version, signing key, endpoint, and payout. Registration alone never makes a service trusted.",
    action: {
      label: "Read Trust Model",
      href: PUBLIC_LINKS.docsArchitecture,
    },
    visual: "identity",
  },
  {
    eyebrow: "02 / Policy",
    title: "Put rules in the payment path",
    body: "Purchase and daily caps, explicit trust, blocks, pause, and a fixed dispatch rate are enforced before the core reserves funds.",
    action: {
      label: "View Payment Gate",
      href: PUBLIC_LINKS.docsGatePayment,
    },
    visual: "policy",
  },
  {
    eyebrow: "03 / Settlement",
    title: "Keep uncertainty visible",
    body: "Follow each stable payment ID through pending, settled, or failed. A missing callback keeps the reservation; a timeout never authorizes a second payment.",
    action: {
      label: "Inspect Settlement",
      href: PUBLIC_LINKS.docsTrustGate,
    },
    visual: "proofs",
  },
] as const;
