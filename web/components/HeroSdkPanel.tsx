import HeroSdkCommand from "@/components/HeroSdkCommand";
import HeroSdkTerminal from "@/components/HeroSdkTerminal";
import styles from "@/components/HeroSdkPanel.module.css";
import {
  HERO_SDK_COMMAND,
  HERO_SDK_COPY,
  HERO_SDK_LINKS,
  HERO_TERMINAL_LINES,
} from "@/data/heroSdk";

interface LinkIconProps {
  readonly type: "github" | "package";
}

function LinkIcon({ type }: LinkIconProps) {
  if (type === "github") {
    return (
      <svg className={styles.linkIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.6a9.7 9.7 0 0 0-3.1 18.9c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1 2.9.8.1-.6.3-1 .6-1.3-2.2-.3-4.5-1.1-4.5-4.8 0-1.1.4-1.9 1-2.6-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.5 1 2.6 0 3.7-2.3 4.5-4.5 4.8.4.3.7.9.7 1.8V21c0 .3.2.6.7.5A9.7 9.7 0 0 0 12 2.6Z" />
      </svg>
    );
  }

  return (
    <svg className={styles.linkIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.4 12 3l8 4.4v9.2L12 21l-8-4.4V7.4Z" />
      <path d="m4.5 7.6 7.5 4.2 7.5-4.2" />
      <path d="M12 12v8.2" />
    </svg>
  );
}

export default function HeroSdkPanel() {
  return (
    <section
      className={styles.panel}
      data-hero-fade
      aria-labelledby="hero-sdk-panel-title"
    >
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{HERO_SDK_COPY.eyebrow}</p>
        <h2 className={styles.title} id="hero-sdk-panel-title">
          {HERO_SDK_COPY.title}
        </h2>
        <p className={styles.body}>{HERO_SDK_COPY.body}</p>

        <HeroSdkCommand
          command={HERO_SDK_COMMAND}
          copiedLabel={HERO_SDK_COPY.copiedLabel}
          label={HERO_SDK_COPY.commandLabel}
        />

        <nav className={styles.links} aria-label="SDK references">
          {HERO_SDK_LINKS.map((link) => (
            <a
              className={styles.link}
              href={link.href}
              key={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkIcon type={link.icon} />
              <span>
                <strong>{link.label}</strong>
                <small>{link.meta}</small>
              </span>
            </a>
          ))}
        </nav>
      </div>

      <HeroSdkTerminal
        lines={HERO_TERMINAL_LINES}
        title={HERO_SDK_COPY.terminalTitle}
      />
    </section>
  );
}
