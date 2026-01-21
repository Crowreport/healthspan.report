import styles from "./AdPlaceholder.module.css";

interface AdPlaceholderProps {
  size?: "banner" | "rectangle" | "leaderboard" | "skyscraper";
  label?: string;
}

export default function AdPlaceholder({
  size = "rectangle",
  label = "Advertisement",
}: AdPlaceholderProps) {
  return (
    <div className={`${styles.ad} ${styles[size]}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.pattern}>
        <svg viewBox="0 0 100 100" className={styles.icon}>
          <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.5" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  );
}
