export type StoryVisualKind = "identity" | "policy" | "proofs";

export interface StoryAction {
  readonly href: string;
  readonly label: string;
}

export interface StoryPanel {
  readonly action: StoryAction;
  readonly body: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly visual: StoryVisualKind;
}
