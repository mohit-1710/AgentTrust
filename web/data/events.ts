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
  "Follow SDK labs, proof reviews, and settlement sessions for teams routing AI-agent payments through AgentTrust.";

export const EVENTS: readonly EventItem[] = [
  {
    date: "SDK",
    description:
      "Install the package, call the payment gate, and inspect the allow or deny branch.",
    event: "AgentTrust quickstart lab",
    href: PUBLIC_LINKS.docsQuickstart,
    imageAlt: "Abstract trust gate route diagram",
    imageSrc: "/media/event-trust-gate.svg",
    location: "Remote",
  },
  {
    date: "Proofs",
    description:
      "Review the invariants that keep policy checks and route state consistent.",
    event: "Formal verification review",
    href: PUBLIC_LINKS.docsFormalVerification,
    imageAlt: "Proof grid with verified check paths",
    imageSrc: "/media/event-proof-review.svg",
    location: "GitHub",
  },
  {
    date: "Settlement",
    description:
      "Review how policy, transfer, and feedback stay in one signed settlement path.",
    event: "Atomic route session",
    href: PUBLIC_LINKS.docsAtomicSettlement,
    imageAlt: "SDK integration cards connected by purple lines",
    imageSrc: "/media/event-sdk-lab.svg",
    location: "Solana builders",
  },
  {
    date: "Adapters",
    description:
      "Bring a new route into the same AgentTrust decision path without rewriting policy logic.",
    event: "New route lab",
    href: PUBLIC_LINKS.docsFacilitatorAdapters,
    imageAlt: "Verifier nodes around an AgentTrust triangle",
    imageSrc: "/media/event-operator-briefing.svg",
    location: "Partner call",
  },
];
