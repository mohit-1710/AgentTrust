import type { ReactNode } from "react";

import Icon, { type IconName } from "@/components/blog/Icon";
import styles from "@/components/blog/Pillar.module.css";

interface PillarProps {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
}

export function Pillar({ icon, title, body }: PillarProps) {
  return (
    <div className={styles.item}>
      <span className={styles.icon}>
        <Icon name={icon} size={20} />
      </span>
      <h4 className={styles.title}>{title}</h4>
      <p className={styles.body}>{body}</p>
    </div>
  );
}

interface PillarGridProps {
  readonly children: ReactNode;
}

export function PillarGrid({ children }: PillarGridProps) {
  return <div className={styles.grid}>{children}</div>;
}
