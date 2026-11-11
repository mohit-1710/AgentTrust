import styles from "@/components/TopNav.module.css";
import type { NavigationIcon } from "@/data/navigation";

interface TopNavDropdownIconProps {
  readonly icon: NavigationIcon;
}

const ICON_PATHS: Record<NavigationIcon, readonly string[]> = {
  book: [
    "M4 19.5A2.5 2.5 0 0 1 6.5 17H20",
    "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z",
  ],
  box: [
    "M21 8 12 3 3 8l9 5 9-5z",
    "M3 8v8l9 5 9-5V8",
    "M12 13v8",
  ],
  code: ["M16 18 22 12 16 6", "M8 6 2 12 8 18"],
  file: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
  ],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  terminal: ["M4 17 10 11 4 5", "M12 19h8"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
};

export default function TopNavDropdownIcon({ icon }: TopNavDropdownIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={styles.dropdownIcon}
      viewBox="0 0 24 24"
      fill="none"
    >
      {ICON_PATHS[icon].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
