import { PUBLIC_LINKS } from "@/data/links";

export interface DevnetProgram {
  readonly name: string;
  readonly address: string;
  readonly role: string;
  readonly docsHref: string;
}

export const PROGRAMS_SECTION_ID = "programs";

export const PROGRAMS_EYEBROW = "Live on Solana devnet";

export const PROGRAMS_TITLE = {
  lead: "Three smart contracts,",
  emphasis: "one atomic path.",
} as const;

export const PROGRAMS_INTRO =
  "Three Anchor programs compose into a single payment path on Solana devnet. Every agent payment runs through them, and every address opens in the explorer.";

export const DEVNET_PROGRAMS: readonly DevnetProgram[] = [
  {
    name: "policy_vault",
    address: "8Y6fGeNEHgmWmbt8JsRcF72jxbeBfJhomMjG6SuoJQTR",
    role: "Spending limits, velocity, and pause state, enforced on the payment path.",
    docsHref: PUBLIC_LINKS.docsPolicyVault,
  },
  {
    name: "trustgate",
    address: "HF8zHfoyA7b5mhLViopTnRMprc6ZT5KActHTdkFrih2N",
    role: "Verifies the route, settles the transfer, and records feedback in one transaction.",
    docsHref: PUBLIC_LINKS.docsTrustGate,
  },
  {
    name: "validation_registry",
    address: "Cx4RFa6ysw3qXYhugPkF8pFSWBkmKq59h2dWgF2tKhtv",
    role: "Holds the attestations that prove who an agent is and when each one expires.",
    docsHref: PUBLIC_LINKS.docsValidationRegistry,
  },
];
