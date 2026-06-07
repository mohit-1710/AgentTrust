import PillLink from "@/components/ui/PillLink";
import { HERO_ACTIONS } from "@/data/hero";
import styles from "@/components/Hero.module.css";

export default function HeroActions() {
  return (
    <div className={styles.actions}>
      {HERO_ACTIONS.map((action) => (
        <PillLink
          key={action.href}
          href={action.href}
          icon={action.icon}
          size={action.variant === "primary" ? "heroPrimary" : "heroSecondary"}
          variant={action.variant}
        >
          {action.label}
        </PillLink>
      ))}
    </div>
  );
}
