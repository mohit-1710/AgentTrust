import type { SVGProps } from "react";

type IconName =
  | "signature"
  | "graph"
  | "key"
  | "shield"
  | "chain"
  | "check";

const PATHS: Record<IconName, string> = {
  signature:
    "M3 18c1.5-1 3-3 4.5-6 1-2 .5-4-1-4-1.4 0-2.3 1.5-2 3.3.4 2.2 2.4 5 5.4 6.4 2.4 1.1 4.6.4 5.6-1.1 1-1.5.4-3-1.1-3-1.4 0-2 1.4-2 2.4M18 18h3",
  graph:
    "M4 19V5m0 14h16M8 16l3-3 3 2 5-7",
  key:
    "M14.5 9.5a3.5 3.5 0 1 1-3.07 5.18L4 22H2v-2l6.82-6.82A3.5 3.5 0 1 1 14.5 9.5z M16 7v.01",
  shield:
    "M12 3l8 3v6c0 4.5-3.4 8.6-8 9-4.6-.4-8-4.5-8-9V6l8-3z",
  chain:
    "M9 15a4 4 0 0 1 0-6l3-3a4 4 0 1 1 5.7 5.7l-1.4 1.4M15 9a4 4 0 0 1 0 6l-3 3a4 4 0 1 1-5.7-5.7l1.4-1.4",
  check:
    "M5 12.5l4.5 4.5L19 7",
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  readonly name: IconName;
  readonly size?: number;
}

export default function Icon({ name, size = 24, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
