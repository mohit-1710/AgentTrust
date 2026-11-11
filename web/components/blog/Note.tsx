import type { ReactNode } from "react";

import styles from "@/components/blog/Note.module.css";

interface NoteProps {
  readonly children: ReactNode;
}

export default function Note({ children }: NoteProps) {
  return (
    <aside className={styles.note} role="note">
      {children}
    </aside>
  );
}
