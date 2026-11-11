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
  firstLine: "Bring any route.",
  secondLine: "Keep trust intact.",
} as const;

export const NETWORK_LABELS: readonly NetworkLabel[] = [
  {
    text: "/ Trust contract",
    caption: "One decision shape for every payment path.",
  },
  {
    text: "/ Live x402 route",
    caption: "Pay.sh proves the first integration path.",
  },
  {
    text: "/ Next route",
    caption: "Future facilitators stay explicit, not hard-coded.",
  },
] as const;

export const NETWORK_COPY: readonly NetworkCopySegment[] = [
  { text: "AgentTrust owns the decision path: who is paid, which rules apply, and what feedback is recorded. " },
  { text: "Adapters only translate the route around it.", isDim: true },
] as const;

export const NETWORK_CTA = {
  href: PUBLIC_LINKS.docsFacilitatorAdapters,
  label: "Add A Route",
} as const;

export const NETWORK_SIGNALS: readonly NetworkSignal[] = [
  {
    eyebrow: "01 / Identity",
    title: "Recipient known",
    body: "Agent and counterparty signals resolve before value moves.",
  },
  {
    eyebrow: "02 / Policy",
    title: "Rules enforced",
    body: "Limits and route controls sit in the payment path.",
  },
  {
    eyebrow: "03 / Feedback",
    title: "Receipt emitted",
    body: "Every allow or deny decision leaves a readable trail.",
  },
] as const;
