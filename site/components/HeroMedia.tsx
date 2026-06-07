import HeroInteractiveOverlay from "@/components/HeroInteractiveOverlay";
import { HERO_MEDIA } from "@/data/hero";
import styles from "@/components/Hero.module.css";

export default function HeroMedia() {
  return (
    <figure
      aria-label={HERO_MEDIA.label}
      className={styles.videoWrap}
      data-hero-video
    >
      <video
        className={styles.video}
        autoPlay
        loop
        muted
        playsInline
        poster={HERO_MEDIA.poster}
        preload="metadata"
      >
        <source src={HERO_MEDIA.src} type="video/mp4" />
      </video>
      <HeroInteractiveOverlay />
    </figure>
  );
}
