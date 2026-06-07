import Image from "next/image";
import styles from "@/components/MediaCard.module.css";
import type { MediaCard as MediaCardData } from "@/data/media";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

interface MediaCardProps {
  readonly card: MediaCardData;
}

export default function MediaCard({ card }: MediaCardProps) {
  const externalAttributes = getExternalLinkAttributes(card.href);

  return (
    <a
      className={styles.card}
      href={card.href}
      data-media-card
      {...externalAttributes}
    >
      <Image
        alt={card.imageAlt}
        className={styles.image}
        height={420}
        src={card.imageSrc}
        width={640}
      />
      <div className={styles.content}>
        <span className={styles.blurStack} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{card.eyebrow}</p>
          <h3>{card.title}</h3>
          <p className={styles.summary}>{card.summary}</p>
        </div>
      </div>
    </a>
  );
}
