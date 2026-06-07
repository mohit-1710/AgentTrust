import { PUBLIC_LINKS } from "@/data/links";
import type { StoryPanel } from "@/types/storytelling";

export const STORYTELLING_SECTION_ID = "trust-stack";

export const STORYTELLING_PANELS: readonly StoryPanel[] = [
  {
    eyebrow: "01 / Identity",
    title: "Know the counterparty first",
    body: "Resolve who an agent is paying against the ERC-8004 registries on Monad before any value moves.",
    action: {
      label: "Read Trust Model",
      href: PUBLIC_LINKS.docsArchitecture,
    },
    visual: "identity",
  },
  {
    eyebrow: "02 / Policy",
    title: "Put rules in the payment path",
    body: "Per-tx and daily caps, sliding-window velocity, and a multisig kill-switch live in PolicyVault, so unsafe transfers are denied before settlement.",
    action: {
      label: "View Payment Gate",
      href: PUBLIC_LINKS.docsGatePayment,
    },
    visual: "policy",
  },
  {
    eyebrow: "03 / Reputation",
    title: "Gate on on-chain reputation",
    body: "The gate averages a counterparty's ERC-8004 reputation over your trusted-attestor set, then returns Allow, Deny, or RequireValidation.",
    action: {
      label: "Read Reputation Model",
      href: PUBLIC_LINKS.docsReputation,
    },
    visual: "proofs",
  },
] as const;
