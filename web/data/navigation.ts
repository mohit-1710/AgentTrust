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
            description: "Identity, policy, and feedback before settlement.",
            href: PUBLIC_LINKS.docsArchitecture,
            icon: "shield",
          },
          {
            label: "Atomic Settlement",
            description: "Policy check, SPL transfer, and feedback in one path.",
            href: PUBLIC_LINKS.docsAtomicSettlement,
            icon: "grid",
          },
          {
            label: "Program IDs",
            description: "Devnet addresses for every trust gate component.",
            href: PUBLIC_LINKS.docsProgramIds,
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
            description: "Pay.sh proves one route without owning the trust model.",
            href: PUBLIC_LINKS.docsPayShAdapter,
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
            description: "Read exact accounts, checks, and return states.",
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
        title: "Devnet Surface",
        items: [
          {
            label: "Policy Program",
            description: "Thresholds, pausing, and signer controls.",
            href: PUBLIC_LINKS.docsPolicyVault,
            icon: "shield",
          },
          {
            label: "Feedback Program",
            description: "Receipt-grade feedback after settlement.",
            href: PUBLIC_LINKS.docsTrustGate,
            icon: "terminal",
          },
          {
            label: "Registry",
            description: "Validation expiry and counterparty status.",
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
            description: "Implementation notes and account layouts.",
            href: PUBLIC_LINKS.docs,
            icon: "book",
          },
          {
            label: "Live Adapter Example",
            description: "Worked route using Pay.sh and AgentTrust.",
            href: PUBLIC_LINKS.docsPayShAdapter,
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
            description: "Program and SDK checks for payment gates.",
            href: PUBLIC_LINKS.docsGatePayment,
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
