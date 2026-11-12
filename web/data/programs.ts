import { PUBLIC_LINKS } from "@/data/links";
export interface CoreResponsibility {
  readonly name: string; readonly sourcePath: string; readonly role: string; readonly docsHref: string;
}
export const PROGRAMS_SECTION_ID = "programs";
export const PROGRAMS_EYEBROW = "One native NEAR core · deployed on testnet";
export const PROGRAMS_TITLE = { lead: "Three responsibilities,", emphasis: "one spending boundary." } as const;
export const PROGRAMS_INTRO = "A single Rust contract owns the registry, policy admission, and payment ledger. A transfer and its callback run in separate receipts; pending never means paid.";
export const CORE_RESPONSIBILITIES: readonly CoreResponsibility[] = [
  { name: "Owner policy", sourcePath: "contracts/agenttrust-core/src/owner.rs", role: "Direct owner controls: trusted services, blocks, purchase caps, daily caps, pause, and restricted sessions.", docsHref: PUBLIC_LINKS.docsPolicyVault },
  { name: "Payment ledger", sourcePath: "contracts/agenttrust-core/src/payments.rs", role: "Reserve before dispatch, bind the exact invoice, and finalize once from a private callback.", docsHref: PUBLIC_LINKS.docsTrustGate },
  { name: "Service registry", sourcePath: "contracts/agenttrust-core/src/registry.rs", role: "Versioned supplier identity and issuer credentials scoped to one capability and conformance suite.", docsHref: PUBLIC_LINKS.docsValidationRegistry },
];
