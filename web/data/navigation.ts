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
            description: "Supplier identity, owner rules, and final settlement.",
            href: PUBLIC_LINKS.docsArchitecture,
            icon: "shield",
          },
          {
            label: "Asynchronous Settlement",
            description: "Reservation, native transfer, and a separate callback.",
            href: PUBLIC_LINKS.docsSettlement,
            icon: "grid",
          },
          {
            label: "Deployment Status",
            description: "Explicit status and configuration for the native core.",
            href: PUBLIC_LINKS.docsDeployment,
            icon: "file",
          },
        ],
      },
      {
        title: "Native Flow",
        items: [
          {
            label: "HTTP 402 Contract",
            description: "Bind a signed invoice to a native payment attempt.",
            href: PUBLIC_LINKS.docsHttp402,
            icon: "box",
          },
          {
            label: "Audit Capability",
            description: "One bounded invoice-CSV audit and its fixture suite.",
            href: PUBLIC_LINKS.docsAuditExample,
            icon: "users",
          },
          {
            label: "Settlement Flow",
            description: "See the path from admission to final payment state.",
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
            description: "Prepare the checkout and inspect the local checks.",
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
            description: "Follow the custom HTTP 402 integration in development.",
            href: PUBLIC_LINKS.docsHttp402,
            icon: "file",
          },
        ],
      },
      {
        title: "Core Responsibilities",
        items: [
          {
            label: "Owner Policy",
            description: "Thresholds, pausing, and signer controls.",
            href: PUBLIC_LINKS.docsPolicyVault,
            icon: "shield",
          },
          {
            label: "Payment Ledger",
            description: "Pending, settled, and failed are distinct states.",
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
            label: "Audit Capability",
            description: "Controlled providers, named fixtures, and a scoped issuer.",
            href: PUBLIC_LINKS.docsAuditExample,
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
            label: "HTTP 402 Flow",
            description: "Inspect quote, retry, and receipt-binding requirements.",
            href: PUBLIC_LINKS.docsHttp402,
            icon: "shield",
          },
          {
            label: "Test Matrix",
            description: "Contract and SDK checks for payment admission.",
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
