import AgentTrustLogo from "@/components/AgentTrustLogo";
import TopNavDropdown from "@/components/TopNavDropdown";
import TopNavLink from "@/components/TopNavLink";
import styles from "@/components/TopNav.module.css";
import PillLink from "@/components/ui/PillLink";
import { PRIMARY_NAV_CTA, PRIMARY_NAV_LINKS } from "@/data/navigation";

export default function TopNav() {
  return (
    <header className={styles.header}>
      <nav aria-label="Primary navigation" className={styles.nav}>
        <AgentTrustLogo />

        <div className={styles.cluster}>
          <div className={styles.listWrap}>
            <ul className={styles.list}>
              {PRIMARY_NAV_LINKS.map((link) => (
                <li className={styles.item} key={link.label}>
                  <TopNavLink href={link.href} label={link.label} />
                  {link.menu ? (
                    <TopNavDropdown columns={link.menu} label={link.label} />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <PillLink
            href={PRIMARY_NAV_CTA.href}
            size="nav"
            variant="secondary"
          >
            {PRIMARY_NAV_CTA.label}
          </PillLink>
        </div>
      </nav>
    </header>
  );
}
