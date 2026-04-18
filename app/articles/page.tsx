import { Header, Footer } from "@/components/layout";
import { getArticlesFromDB } from "@/lib/content/articles";
import { getCurrentUser } from "@/lib/auth";
import ArticlesGridWithEdit from "@/components/articles/ArticlesGridWithEdit";
import styles from "./page.module.css";

export default async function ArticlesPage() {
  const [user, { articles, error }] = await Promise.all([
    getCurrentUser(),
    getArticlesFromDB(80),
  ]);
  const isAdmin = user?.role === "admin";

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

          {error ? (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          ) : articles.length === 0 ? (
            <div className={styles.empty}>
              <p>No articles available at the moment.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              <ArticlesGridWithEdit articles={articles} isAdmin={!!isAdmin} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
