import { PUBLIC_LINKS } from "@/data/links";

export interface DevnetProgram {
  readonly name: string;
  readonly address: string;
  readonly role: string;
  readonly docsHref: string;
  readonly kind: "contract" | "registry";
}

export const PROGRAMS_SECTION_ID = "programs";

export const PROGRAMS_EYEBROW = "Live on Monad testnet";

export const PROGRAMS_TITLE = {
  lead: "One gate. Three registries.",
  emphasis: "One decision.",
} as const;

export const PROGRAMS_INTRO =
  "We deployed one contract: PolicyVault. It reads the three canonical ERC-8004 registries already live on Monad, then returns a single Allow, Deny, or RequireValidation before any USDC moves. Every address opens in the explorer.";

export const DEVNET_PROGRAMS: readonly DevnetProgram[] = [
  {
    name: "PolicyVault",
    address: "0x34b3bB1a99377128126201359749FE7614275E37",
    role: "The contract we deployed. A non-custodial pre-payment gate: per-tx and daily caps, sliding-window velocity, multisig kill-switch, and a counterparty reputation threshold, all enforced before settlement.",
    docsHref: PUBLIC_LINKS.docsPolicyVault,
    kind: "contract",
  },
  {
    name: "IdentityRegistry",
    address: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    role: "Canonical ERC-8004 registry on Monad that we read to resolve who an agent is.",
    docsHref: PUBLIC_LINKS.docsValidationRegistry,
    kind: "registry",
  },
  {
    name: "ReputationRegistry",
    address: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    role: "Canonical ERC-8004 registry on Monad. The gate averages a counterparty's reputation over a payer-chosen trusted-attestor set for Sybil resistance.",
    docsHref: PUBLIC_LINKS.docsReputation,
    kind: "registry",
  },
  {
    name: "ValidationRegistry",
    address: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
    role: "Canonical ERC-8004 registry on Monad that we read for optional capability validation when a policy requires it.",
    docsHref: PUBLIC_LINKS.docsValidationRegistry,
    kind: "registry",
  },
];
