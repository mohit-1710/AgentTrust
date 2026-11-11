import { PUBLIC_LINKS } from "@/data/links";
import type { StoryPanel } from "@/types/storytelling";

export const STORYTELLING_SECTION_ID = "trust-stack";

export const STORYTELLING_PANELS: readonly StoryPanel[] = [
  {
    eyebrow: "01 / Identity",
    title: "Know the counterparty first",
    body: "Resolve who an agent is paying, which attestations are current, and whether the recipient is trusted before value moves.",
    action: {
      label: "Read Trust Model",
      href: PUBLIC_LINKS.docsArchitecture,
    },
    visual: "identity",
  },
  {
    eyebrow: "02 / Policy",
    title: "Put rules in the payment path",
    body: "Limits, allowlists, pause state, and velocity checks sit directly on the route, so unsafe transfers fail before settlement.",
    action: {
      label: "View Payment Gate",
      href: PUBLIC_LINKS.docsGatePayment,
    },
    visual: "policy",
  },
  {
    eyebrow: "03 / Feedback",
    title: "Make trust decisions auditable",
    body: "Feedback records the reason a route passed or stopped, giving builders a clear trail after every payment decision.",
    action: {
      label: "Inspect Feedback",
      href: PUBLIC_LINKS.docsTrustGate,
    },
    visual: "proofs",
  },
] as const;
