import { PUBLIC_LINKS } from "@/data/links";

export interface NetworkLabel {
  readonly caption: string;
  readonly text: string;
}

export interface NetworkCopySegment {
  readonly isDim?: boolean;
  readonly text: string;
}

export interface NetworkSignal {
  readonly body: string;
  readonly eyebrow: string;
  readonly title: string;
}

export const NETWORK_HEADLINE = {
  firstLine: "Choose a supplier.",
  secondLine: "Keep control.",
} as const;

export const NETWORK_LABELS: readonly NetworkLabel[] = [
  {
    text: "/ One native core",
    caption: "Owner policy stays on the payment path.",
  },
  {
    text: "/ Custom HTTP 402",
    caption: "One native adapter in development; no standard-exact claim.",
  },
  {
    text: "/ Controlled demonstration",
    caption: "Planned: two controlled providers, one invoice-audit capability.",
  },
] as const;

export const NETWORK_COPY: readonly NetworkCopySegment[] = [
  { text: "The buyer selects from explicitly configured suppliers. Owner policy determines who may be paid and how much. " },
  { text: "An endpoint in the catalog is not permission to spend.", isDim: true },
] as const;

export const NETWORK_CTA = {
  href: PUBLIC_LINKS.docsHttp402,
  label: "Read the HTTP Flow",
} as const;

export const NETWORK_SIGNALS: readonly NetworkSignal[] = [
  {
    eyebrow: "01 / Identity",
    title: "Recipient known",
    body: "A signed invoice binds the exact request and registered payout.",
  },
  {
    eyebrow: "02 / Policy",
    title: "Rules enforced",
    body: "A restricted worker calls one payment method with zero attached deposit.",
  },
  {
    eyebrow: "03 / Settlement",
    title: "State observed",
    body: "Only a final settled payment releases output. Previews never invent receipts.",
  },
] as const;
