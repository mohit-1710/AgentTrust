export interface SectionMarker {
  readonly label: string;
  readonly href: string;
}

export const SECTION_MARKERS: readonly SectionMarker[] = [
  { label: "AgentTrust", href: "#home" },
  { label: "A New Benchmark", href: "#benchmark" },
  { label: "Trust Stack", href: "#trust-stack" },
  { label: "Programs", href: "#programs" },
  { label: "Performance", href: "#performance" },
  { label: "Plug And Play", href: "#plug-and-play" },
  { label: "The Network", href: "#network" },
  { label: "The Trilemma", href: "#trilemma" },
  { label: "Explore", href: "#explore" },
];
