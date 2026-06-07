import TopNavDropdownIcon from "@/components/TopNavDropdownIcon";
import styles from "@/components/TopNav.module.css";
import type { NavigationMenuColumn } from "@/data/navigation";
import { getExternalLinkAttributes } from "@/lib/linkAttributes";

interface TopNavDropdownProps {
  readonly columns: readonly NavigationMenuColumn[];
  readonly label: string;
}

export default function TopNavDropdown({ columns, label }: TopNavDropdownProps) {
  return (
    <div className={styles.dropdown} aria-label={`${label} menu`}>
      <div className={styles.dropdownShell}>
        <div className={styles.dropdownGrid}>
          {columns.map((column) => (
            <div className={styles.dropdownColumn} key={column.title}>
              <p className={styles.dropdownHeading}>{column.title}</p>
              <div className={styles.dropdownList}>
                {column.items.map((item) => {
                  const externalAttributes = getExternalLinkAttributes(
                    item.href,
                  );

                  return (
                    <a
                      className={styles.dropdownLink}
                      href={item.href}
                      key={item.label}
                      {...externalAttributes}
                    >
                      <TopNavDropdownIcon icon={item.icon} />
                      <span className={styles.dropdownCopy}>
                        <span className={styles.dropdownTitle}>
                          {item.label}
                        </span>
                        <span className={styles.dropdownDescription}>
                          {item.description}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
