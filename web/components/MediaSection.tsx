import MediaContent from "@/components/MediaContent";
import styles from "@/components/MediaSection.module.css";

export default function MediaSection() {
  return (
    <section id="media" className={styles.section} aria-labelledby="media-title">
      <div className={styles.spacer} aria-hidden="true" />
      <div className={styles.container}>
        <MediaContent />
      </div>
    </section>
  );
}
