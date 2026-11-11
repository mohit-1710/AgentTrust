import type { ReactNode } from "react";

import styles from "@/components/blog/Quote.module.css";

interface QuoteProps {
  readonly children: ReactNode;
  readonly attribution?: string;
}

export default function Quote({ children, attribution }: QuoteProps) {
  return (
    <figure className={styles.quote}>
      <blockquote className={styles.text}>{children}</blockquote>
      {attribution ? (
        <figcaption className={styles.attribution}>{attribution}</figcaption>
      ) : null}
    </figure>
  );
}
