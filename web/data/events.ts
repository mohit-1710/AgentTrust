import { PUBLIC_LINKS } from "@/data/links";

export interface EventItem {
  readonly date: string;
  readonly description: string;
  readonly event: string;
  readonly href: string;
  readonly imageAlt: string;
  readonly imageSrc: string;
  readonly location: string;
}

export const EVENTS_HEADING = "Trust work happens onchain - and in review.";

export const EVENTS_COPY =
  "Read implementation guides and verification notes from the native NEAR build. These are documentation topics, not scheduled events.";

export const EVENTS: readonly EventItem[] = [
  {
    date: "SDK",
    description:
      "Prepare the source checkout and run the pure local checks.",
    event: "Native build quickstart",
    href: PUBLIC_LINKS.docsQuickstart,
    imageAlt: "Abstract trust gate route diagram",
    imageSrc: "/media/event-trust-gate.svg",
    location: "Local checkout",
  },
  {
    date: "Checks",
    description:
      "Review tested properties and the native runtime evidence still required.",
    event: "Verification boundary",
    href: PUBLIC_LINKS.docsVerification,
    imageAlt: "Decorative grid of verification paths",
    imageSrc: "/media/event-proof-review.svg",
    location: "GitHub",
  },
  {
    date: "Settlement",
    description:
      "Follow reservation, transfer, callback, and indefinite pending states.",
    event: "Asynchronous receipt model",
    href: PUBLIC_LINKS.docsSettlement,
    imageAlt: "SDK integration cards connected by purple lines",
    imageSrc: "/media/event-sdk-lab.svg",
    location: "NEAR model",
  },
  {
    date: "HTTP 402",
    description:
      "Inspect the planned signed-quote and settled-receipt flow for one native adapter.",
    event: "Custom HTTP 402 flow",
    href: PUBLIC_LINKS.docsHttp402,
    imageAlt: "Verifier nodes around an AgentTrust triangle",
    imageSrc: "/media/event-operator-briefing.svg",
    location: "Integration notes",
  },
];
