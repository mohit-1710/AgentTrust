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
  "Read identity, implementation, and settlement notes from the native NEAR build.";

export const MEDIA_CARDS: readonly MediaCard[] = [
  {
    eyebrow: "Trust decisions",
    href: PUBLIC_LINKS.docsArchitecture,
    imageAlt: "Signed supplier identity and invoice notes",
    imageSrc: "/media/media-proof-notes.svg",
    summary: "Registered supplier identity and signed requests before dispatch.",
    title: "Identity Notes",
  },
  {
    eyebrow: "Builder updates",
    href: PUBLIC_LINKS.docsHttp402,
    imageAlt: "Native SDK and invoice audit modules connected to the core",
    imageSrc: "/media/media-builder-log.svg",
    summary: "Local SDK wiring, quote handling, and integration boundaries.",
    title: "Builder Log",
  },
  {
    eyebrow: "Asynchronous settlement",
    href: PUBLIC_LINKS.docsSettlement,
    imageAlt: "Reservation, transfer, and callback in separate steps",
    imageSrc: "/media/media-field-notes.svg",
    summary: "Reserve funds before dispatch and observe a final payment state.",
    title: "Settlement Notes",
  },
];
