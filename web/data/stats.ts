export interface HeroStat { readonly value: string; readonly label: string }
export const HERO_STATS: readonly HeroStat[] = [
  { value: "NEAR", label: "Native asset" },
  { value: "1", label: "Core contract" },
  { value: "Scoped", label: "Worker key" },
  { value: "MIT", label: "Source license" },
];
