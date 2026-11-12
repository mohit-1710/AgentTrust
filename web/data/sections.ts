export interface SectionMarker {
  readonly label: string;
  readonly href: string;
}

export const SECTION_MARKERS: readonly SectionMarker[] = [
  { label: "AgentTrust", href: "#home" },
  { label: "Spending Boundary", href: "#benchmark" },
  { label: "Trust Stack", href: "#trust-stack" },
  { label: "Core Responsibilities", href: "#programs" },
  { label: "Payment Model", href: "#performance" },
  { label: "Local Tools", href: "#plug-and-play" },
  { label: "Supplier Catalog", href: "#network" },
  { label: "Payment Steps", href: "#trilemma" },
  { label: "Explore", href: "#explore" },
];
