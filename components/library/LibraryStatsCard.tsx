import type { LibraryFolder } from "@/lib/content/libraryTypes";
import styles from "./LibraryStatsCard.module.css";

interface LibraryStatsCardProps {
  folders: LibraryFolder[];
  countsByFolder: Record<string, number>;
  totalCount: number;
}

export default function LibraryStatsCard({ folders, countsByFolder, totalCount }: LibraryStatsCardProps) {
  return (
    <section className={styles.card} aria-label="Library stats">
      <h3 className={styles.title}>Library Stats</h3>

      <div className={styles.total}>
        <span className={styles.totalLabel}>Total saved</span>
        <span className={styles.totalValue}>{totalCount}</span>
      </div>

      {folders.length > 0 && (
        <ul className={styles.list}>
          {folders.map((folder) => (
            <li key={folder.id} className={styles.row}>
              <span>{folder.name}</span>
              <span className={styles.rowCount}>{countsByFolder[folder.id] ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
