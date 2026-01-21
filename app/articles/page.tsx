import { Header, Footer } from "@/components/layout";
import { ArticleCard } from "@/components/ui";
import { articles } from "@/data/mockData";
import styles from "./page.module.css";

export const metadata = {
  title: "Articles | Healthspan",
  description: "Browse our collection of evidence-based longevity research articles.",
};

export default function ArticlesPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Articles</h1>
            <p className={styles.subtitle}>
              Evidence-based research and insights on longevity, healthspan, and
              wellness.
            </p>
          </div>

          <div className={styles.grid}>
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
            {/* Duplicate for demo purposes */}
            {articles.map((article) => (
              <ArticleCard key={`dup-${article.id}`} article={article} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
