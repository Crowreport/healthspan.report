import { Header, Footer } from "@/components/layout";
import styles from "./page.module.css";

export default function ResearchLoading() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div style={{ height: 40, background: "var(--color-surface-alt)", borderRadius: 4 }} />
            <div style={{ height: 20, width: "70%", background: "var(--color-surface-alt)", borderRadius: 4, marginTop: 8 }} />
          </div>
          <div className={styles.papers}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeleton}>
                <div className={styles.skeletonMeta} />
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonSummary} />
                <div className={styles.skeletonLink} />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
