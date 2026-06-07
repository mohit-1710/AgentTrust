import { PUBLIC_LINKS } from "@/data/links";

export interface NavigationLink {
  readonly label: string;
  readonly href: string;
  readonly menu?: readonly NavigationMenuColumn[];
}

export interface NavigationCta {
  readonly label: string;
  readonly href: string;
}

export type NavigationIcon =
  | "book"
  | "box"
  | "code"
  | "file"
  | "grid"
  | "shield"
  | "terminal"
  | "users";

export interface NavigationMenuItem {
  readonly description: string;
  readonly href: string;
  readonly icon: NavigationIcon;
  readonly label: string;
}

export interface NavigationMenuColumn {
  readonly items: readonly NavigationMenuItem[];
  readonly title: string;
}

export const PRIMARY_NAV_LINKS: readonly NavigationLink[] = [
  { label: "Home", href: "#home" },
  {
    label: "Explore",
    href: "#explore",
    menu: [
      {
        title: "Explore AgentTrust",
        items: [
          {
            label: "Trust Layer",
            description: "Identity, policy, and reputation before settlement.",
            href: PUBLIC_LINKS.docsArchitecture,
            icon: "shield",
          },
          {
            label: "x402 Settlement",
            description: "The gate runs inline in verify, gate, settle.",
            href: PUBLIC_LINKS.docsSettlement,
            icon: "grid",
          },
          {
            label: "Contract Addresses",
            description: "Monad testnet addresses for the gate and registries.",
            href: PUBLIC_LINKS.docsContractAddresses,
            icon: "file",
          },
        ],
      },
      {
        title: "Route Signals",
        items: [
          {
            label: "Adapter Contract",
            description: "Bring routes into one AgentTrust decision shape.",
            href: PUBLIC_LINKS.docsFacilitatorAdapters,
            icon: "box",
          },
          {
            label: "Live Route",
            description: "The molandak x402 facilitator proves one live route.",
            href: PUBLIC_LINKS.docsX402Adapter,
            icon: "users",
          },
          {
            label: "Settlement Flow",
            description: "See the trust check path from request to allow.",
            href: "#trilemma",
            icon: "terminal",
          },
        ],
      },
    ],
  },
  {
    label: "Build",
    href: PUBLIC_LINKS.docsQuickstart,
    menu: [
      {
        title: "Start Building",
        items: [
          {
            label: "Quickstart",
            description: "Install the SDK and drive a local payment gate.",
            href: PUBLIC_LINKS.docsQuickstart,
            icon: "code",
          },
          {
            label: "Developer Brief",
            description: "Read the exact inputs, checks, and return states.",
            href: PUBLIC_LINKS.docsArchitecture,
            icon: "book",
          },
          {
            label: "Integration Notes",
            description: "Keep route-specific details outside trust logic.",
            href: PUBLIC_LINKS.docsFacilitatorAdapters,
            icon: "file",
          },
        ],
      },
      {
        title: "Testnet Surface",
        items: [
          {
            label: "PolicyVault",
            description: "Caps, velocity, kill-switch, and reputation threshold.",
            href: PUBLIC_LINKS.docsPolicyVault,
            icon: "shield",
          },
          {
            label: "Reputation",
            description: "ERC-8004 reputation read over a trusted-attestor set.",
            href: PUBLIC_LINKS.docsReputation,
            icon: "terminal",
          },
          {
            label: "Registry",
            description: "ERC-8004 validation and counterparty status.",
            href: PUBLIC_LINKS.docsValidationRegistry,
            icon: "grid",
          },
        ],
      },
    ],
  },
  { label: "Blog", href: PUBLIC_LINKS.blog },
  {
    label: "Resources",
    href: PUBLIC_LINKS.docs,
    menu: [
      {
        title: "References",
        items: [
          {
            label: "Documentation",
            description: "Implementation notes and contract reference.",
            href: PUBLIC_LINKS.docs,
            icon: "book",
          },
          {
            label: "Live Adapter Example",
            description: "Worked route using the molandak x402 facilitator.",
            href: PUBLIC_LINKS.docsX402Adapter,
            icon: "box",
          },
          {
            label: "MIT License",
            description: "Open-source grant-friendly license surface.",
            href: PUBLIC_LINKS.githubLicense,
            icon: "file",
          },
        ],
      },
      {
        title: "Integration",
        items: [
          {
            label: "Route Adapters",
            description: "Add new routes without rewriting trust checks.",
            href: PUBLIC_LINKS.docsFacilitatorAdapters,
            icon: "shield",
          },
          {
            label: "Test Matrix",
            description: "20 Foundry tests plus SDK checks for the gate.",
            href: PUBLIC_LINKS.docsTesting,
            icon: "grid",
          },
          {
            label: "Contact",
            description: "Reach the maintainers for integration review.",
            href: PUBLIC_LINKS.githubIssues,
            icon: "users",
          },
        ],
      },
    ],
  },
];

export const PRIMARY_NAV_CTA: NavigationCta = {
  label: "Read the Documentation",
  href: PUBLIC_LINKS.docs,
};
