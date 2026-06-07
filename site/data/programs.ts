import { PUBLIC_LINKS } from "@/data/links";

export interface DevnetProgram {
  readonly name: string;
  readonly address: string;
  readonly role: string;
  readonly docsHref: string;
}

export const PROGRAMS_SECTION_ID = "programs";

export const PROGRAMS_EYEBROW = "Live on Monad testnet";

export const PROGRAMS_TITLE = {
  lead: "Four smart contracts,",
  emphasis: "one atomic path.",
} as const;

export const PROGRAMS_INTRO =
  "The PolicyVault and the ERC-8004 registries compose into a single payment path on Monad testnet. Every agent payment runs through them, and every address opens in the explorer.";

export const DEVNET_PROGRAMS: readonly DevnetProgram[] = [
  {
    name: "PolicyVault",
    address: "0x34b3bB1a99377128126201359749FE7614275E37",
    role: "Spending limits, velocity, and pause state, enforced on the payment path.",
    docsHref: PUBLIC_LINKS.docsPolicyVault,
  },
  {
    name: "IdentityRegistry",
    address: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    role: "ERC-8004 registry that resolves who an agent is on Monad.",
    docsHref: PUBLIC_LINKS.docsValidationRegistry,
  },
  {
    name: "ReputationRegistry",
    address: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    role: "ERC-8004 registry holding the on-chain reputation read on the payment path.",
    docsHref: PUBLIC_LINKS.docsTrustGate,
  },
  {
    name: "ValidationRegistry",
    address: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
    role: "ERC-8004 registry holding the attestations that prove capability and when each expires.",
    docsHref: PUBLIC_LINKS.docsValidationRegistry,
  },
];
