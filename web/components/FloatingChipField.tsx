import type { CSSProperties } from "react";
import styles from "@/components/FloatingChipField.module.css";
import { PLUG_CHIP_ROWS } from "@/data/plugAndPlay";

interface RowStyle extends CSSProperties {
  "--row-duration": string;
  "--row-offset": string;
}

export default function FloatingChipField() {
  return (
    <div className={styles.field} aria-hidden="true">
      {PLUG_CHIP_ROWS.map((row) => {
        const rowStyle: RowStyle = {
          "--row-duration": row.duration,
          "--row-offset": row.offset,
        };
        const rowClassName = row.reverse
          ? `${styles.row} ${styles.rowReverse}`
          : styles.row;
        const labels = [...row.labels, ...row.labels];

        return (
          <div className={styles.rows} key={row.offset} style={rowStyle}>
            <div className={rowClassName}>
              {labels.map((label, index) => (
                <span className={styles.chip} key={`${label}-${index}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
