import { PUBLIC_LINKS } from "@/data/links";

export interface ExploreCard {
  readonly description: string;
  readonly href: string;
  readonly imageAlt: string;
  readonly imageSrc: string;
  readonly title: string;
}

export const EXPLORE_HEADING = "Explore AgentTrust";

export const EXPLORE_CARDS: readonly ExploreCard[] = [
  {
    description:
      "See how identity, policy, and feedback combine before settlement.",
    href: PUBLIC_LINKS.docsArchitecture,
    imageAlt: "",
    imageSrc: "/media/explore-trust-layer.svg",
    title: "Trust Layer",
  },
  {
    description:
      "Install the SDK, run the demo, and wire AgentTrust into your route.",
    href: PUBLIC_LINKS.docsQuickstart,
    imageAlt: "",
    imageSrc: "/media/explore-builder-kit.svg",
    title: "Builder Kit",
  },
];
