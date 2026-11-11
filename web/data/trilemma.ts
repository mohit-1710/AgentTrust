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
  center: "All before settlement.",
  centerLines: ["All before", "settlement."],
  leadLines: [
    "AI-agent payments used to split identity,",
    "policy, and feedback into separate trust moments.",
  ],
  pillars: [
    { label: "Identity", caption: "Counterparty signal" },
    { label: "Policy", caption: "Gate decision" },
    { label: "Feedback", caption: "Reputation record" },
  ],
  resolveEmphasis: "atomically",
  resolvePrefix: "AgentTrust composes all three",
  resolveSuffix: "on Solana.",
};
