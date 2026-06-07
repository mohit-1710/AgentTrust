import styles from "@/components/NetworkGlobe.module.css";

export default function NetworkGlobe() {
  return (
    <div className={styles.globe} aria-hidden="true" data-network-globe>
      <div className={styles.wash} />
      <svg className={styles.svg} viewBox="0 0 420 420">
        <path className={styles.arc} d="M34 236C120 169 241 127 386 139" />
        <path className={styles.arc} d="M69 99C170 224 282 285 371 310" />
        <path className={styles.arc} d="M164 33C226 141 225 270 161 386" />
        <path className={styles.arc} d="M49 310C138 280 250 253 381 234" />
        <path className={styles.pillar} d="M210 110 296 260H124Z" />
        <circle className={styles.node} cx="210" cy="110" r="5" />
        <circle className={styles.node} cx="296" cy="260" r="5" />
        <circle className={styles.node} cx="124" cy="260" r="5" />
      </svg>
    </div>
  );
}
