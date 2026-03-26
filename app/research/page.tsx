import { Header, Footer } from "@/components/layout";
import { getResearchPapersFromDB } from "@/lib/content/research";
import { getCurrentUser } from "@/lib/auth";
import ResearchPageContent from "./ResearchPageContent";
import styles from "./page.module.css";

export default async function ResearchPage() {
  const [user, { papers, error }] = await Promise.all([
    getCurrentUser(),
    getResearchPapersFromDB(80),
  ]);
  const isAdmin = user?.role === "admin";

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Research</h1>
            <p className={styles.subtitle}>
              Deep dives into the latest longevity research, clinical trials, and
              scientific breakthroughs.
            </p>
          </div>

          {error ? (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          ) : papers.length === 0 ? (
            <div className={styles.empty}>
              <p>No research papers available at the moment.</p>
            </div>
          ) : (
            <ResearchPageContent papers={papers} isAdmin={!!isAdmin} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
