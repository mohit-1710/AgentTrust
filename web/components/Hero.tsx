import HeroActions from "@/components/HeroActions";
import HeroHeadline from "@/components/HeroHeadline";
import HeroMedia from "@/components/HeroMedia";
import HeroReveal from "@/components/HeroReveal";
import HeroSdkPanel from "@/components/HeroSdkPanel";
import HeroStatsPanel from "@/components/HeroStatsPanel";
import styles from "@/components/Hero.module.css";
import {
  HERO_BODY,
  HERO_FOUNDATION_LINE,
} from "@/data/hero";

export default function Hero() {
  return (
    <section id="home" className={styles.hero} aria-labelledby="hero-title">
      <HeroReveal>
        <div className={styles.shell}>
          <div className={styles.frame}>
            <div className={styles.copy}>
              <p className={styles.foundation} data-hero-fade>
                {HERO_FOUNDATION_LINE}
              </p>

              <HeroHeadline />

              <div className={styles.rule} data-hero-rule />

              <div className={styles.support} data-hero-fade>
                <p className={styles.body}>{HERO_BODY}</p>
                <HeroActions />
              </div>

              <div className={styles.rule} data-hero-rule />
            </div>

            <HeroStatsPanel />
            <HeroMedia />
            <HeroSdkPanel />
          </div>
        </div>
      </HeroReveal>
    </section>
  );
}
