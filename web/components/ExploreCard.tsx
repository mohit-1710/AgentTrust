import Image from "next/image";
import styles from "@/components/ExploreCard.module.css";
import type { ExploreCard as ExploreCardData } from "@/data/explore";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

export interface ExploreCardProps {
  readonly card: ExploreCardData;
}

export default function ExploreCard({ card }: ExploreCardProps) {
  const externalAttributes = getExternalLinkAttributes(card.href);

  return (
    <a
      className={styles.cardLink}
      href={card.href}
      data-explore-card
      {...externalAttributes}
    >
      <span className={styles.greebles} aria-hidden="true">
        <span className={styles.greebleTopLeft} />
        <span className={styles.greebleTopRight} />
        <span className={styles.greebleBottomLeft} />
        <span className={styles.greebleBottomRight} />
      </span>
      <span className={styles.cardPanel} data-explore-card-panel>
        <span className={styles.cardDots} aria-hidden="true" />
        <span className={styles.imageWrap}>
          <Image
            src={card.imageSrc}
            alt={card.imageAlt}
            width={768}
            height={512}
            className={styles.image}
            aria-hidden={card.imageAlt === ""}
          />
        </span>
        <span className={styles.cardText}>
          <span className={styles.cardTitle}>{card.title}</span>
          <span className={styles.cardDescription}>{card.description}</span>
        </span>
      </span>
    </a>
  );
}
