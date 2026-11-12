export interface TrilemmaPillar {
  readonly label: string;
  readonly caption: string;
}

export interface TrilemmaCopy {
  readonly center: string;
  readonly centerLines: readonly string[];
  readonly leadLines: readonly string[];
  readonly pillars: readonly TrilemmaPillar[];
  readonly resolvePrefix: string;
  readonly resolveEmphasis: string;
  readonly resolveSuffix: string;
}

export const TRILEMMA_COPY: TrilemmaCopy = {
  center: "Check before dispatch.",
  centerLines: ["Check before", "dispatch."],
  leadLines: [
    "An agent can choose the next useful service.",
    "Its owner decides the spending boundary.",
  ],
  pillars: [
    { label: "Identity", caption: "Signed supplier" },
    { label: "Policy", caption: "Owner constraints" },
    { label: "Settlement", caption: "Final payment state" },
  ],
  resolveEmphasis: "with reservations",
  resolvePrefix: "AgentTrust connects the steps",
  resolveSuffix: "on NEAR.",
};
