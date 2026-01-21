import { ArticleCard, AdPlaceholder } from "@/components/ui";
import { articles } from "@/data/mockData";
import styles from "./ArticleGrid.module.css";

export default function ArticleGrid() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Latest Research</h2>
          <a href="/articles" className={styles.viewAll}>
            View all articles
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <div className={styles.grid}>
          <div className={styles.articles}>
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          <aside className={styles.sidebar}>
            <AdPlaceholder size="rectangle" />
            <div className={styles.wellnessPreview}>
              <h3 className={styles.wellnessTitle}>Wellness Gallery</h3>
              <div className={styles.wellnessImages}>
                <div className={styles.wellnessImage}>
                  <span className={styles.imagePlaceholder}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </span>
                </div>
                <div className={styles.wellnessImage}>
                  <span className={styles.imagePlaceholder}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
