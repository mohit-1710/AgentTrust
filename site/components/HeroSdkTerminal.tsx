import type { HeroTerminalLine } from "@/data/heroSdk";
import type { CSSProperties } from "react";
import styles from "@/components/HeroSdkTerminal.module.css";

export interface HeroSdkTerminalProps {
  readonly lines: readonly HeroTerminalLine[];
  readonly title: string;
}

function getLineClassName(tone: HeroTerminalLine["tone"]) {
  return [styles.line, styles[tone]].join(" ");
}

export default function HeroSdkTerminal({ lines, title }: HeroSdkTerminalProps) {
  return (
    <div
      className={styles.shell}
      role="group"
      aria-label="AgentTrust SDK terminal"
    >
      <div className={styles.bar}>
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.title}>{title}</span>
      </div>

      <div className={styles.body}>
        <span className={styles.glow} aria-hidden="true" />
        {lines.map((line, index) => (
          <p
            className={getLineClassName(line.tone)}
            key={`${line.text}-${index}`}
            style={{ "--line-index": index } as CSSProperties}
          >
            {line.prompt ? (
              <span className={styles.prompt}>{line.prompt}</span>
            ) : null}
            <span>{line.text}</span>
          </p>
        ))}
        <div className={styles.route} aria-hidden="true">
          <span className={styles.routeNode} />
          <span className={styles.routeLine} />
          <span className={styles.routeNode} />
          <span className={styles.routeLine} />
          <span className={styles.routeNode} />
        </div>
      </div>
    </div>
  );
}
