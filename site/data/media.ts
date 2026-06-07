import { PUBLIC_LINKS } from "@/data/links";

export interface MediaCard {
  readonly eyebrow: string;
  readonly href: string;
  readonly imageAlt: string;
  readonly imageSrc: string;
  readonly summary: string;
  readonly title: string;
}

export const MEDIA_HEADING = "AgentTrust Media";

export const MEDIA_COPY =
  "Follow gate notes, builder updates, and settlement writeups from the AgentTrust team.";

export const MEDIA_CARDS: readonly MediaCard[] = [
  {
    eyebrow: "Trust decisions",
    href: PUBLIC_LINKS.docsArchitecture,
    imageAlt: "AgentTrust trust decision cover art with policy and reputation notes",
    imageSrc: "/media/media-proof-notes.svg",
    summary: "Identity, policy, and reputation checks before settlement.",
    title: "Gate Notes",
  },
  {
    eyebrow: "Builder updates",
    href: PUBLIC_LINKS.docsFacilitatorAdapters,
    imageAlt: "Adapter playbook cover showing facilitator files connected to AgentTrust",
    imageSrc: "/media/media-builder-log.svg",
    summary: "SDK wiring, adapter notes, and route integration details.",
    title: "Builder Log",
  },
  {
    eyebrow: "x402 settlement",
    href: PUBLIC_LINKS.docsSettlement,
    imageAlt: "Settlement cover showing the gate running inline in verify, gate, settle",
    imageSrc: "/media/media-field-notes.svg",
    summary: "The gate runs inline in the x402 verify, gate, settle flow on Monad.",
    title: "Settlement Notes",
  },
];
