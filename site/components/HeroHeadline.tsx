import { HERO_HEADLINE, HERO_HEADLINE_LINES } from "@/data/hero";
import styles from "@/components/Hero.module.css";

export default function HeroHeadline() {
  return (
    <h1 id="hero-title" className={styles.heading} aria-label={HERO_HEADLINE}>
      {HERO_HEADLINE_LINES.map((line, lineIndex) => (
        <span key={`line-${lineIndex}`}>
          <span className={styles.lineMask}>
            <span className={styles.line} data-hero-line>
              {line.map((word, wordIndex) => (
                <span key={`${word.text}-${wordIndex}`}>
                  <span
                    className={
                      word.isEmphasized
                        ? `${styles.word} ${styles.emphasizedWord}`
                        : styles.word
                    }
                  >
                    {word.isEmphasized ? (
                      <em className={styles.emphasis}>{word.text}</em>
                    ) : (
                      word.text
                    )}
                  </span>
                  {wordIndex < line.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
          </span>
          {lineIndex < HERO_HEADLINE_LINES.length - 1 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}
