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
  "Follow proof notes, builder updates, and settlement writeups from the AgentTrust team.";

export const MEDIA_CARDS: readonly MediaCard[] = [
  {
    eyebrow: "Trust decisions",
    href: PUBLIC_LINKS.docsArchitecture,
    imageAlt: "AgentTrust trust decision cover art with policy and feedback notes",
    imageSrc: "/media/media-proof-notes.svg",
    summary: "Identity, policy, and feedback checks before settlement.",
    title: "Proof Notes",
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
    eyebrow: "Atomic settlement",
    href: PUBLIC_LINKS.docsAtomicSettlement,
    imageAlt: "Atomic settlement cover showing gate, transfer, and feedback in one route",
    imageSrc: "/media/media-field-notes.svg",
    summary: "Gate payment, SPL transfer, and feedback composed into one signed transaction.",
    title: "Settlement Notes",
  },
];
