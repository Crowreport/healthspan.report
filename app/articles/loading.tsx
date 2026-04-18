import { Header, Footer } from "@/components/layout";
import styles from "./page.module.css";

export default function ArticlesLoading() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.title} style={{ height: 40, background: "var(--color-surface-alt)", borderRadius: 4 }} />
            <div className={styles.subtitle} style={{ height: 20, width: "60%", background: "var(--color-surface-alt)", borderRadius: 4 }} />
          </div>
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeleton}>
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonContent}>
                  <div className={styles.skeletonCategory} />
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonExcerpt} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
