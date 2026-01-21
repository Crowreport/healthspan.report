import { Header, Footer } from "@/components/layout";
import styles from "./page.module.css";

export const metadata = {
  title: "Research | Healthspan",
  description: "Deep dives into longevity research, clinical trials, and scientific studies.",
};

const researchPapers = [
  {
    id: "1",
    title: "Rapamycin and mTORC1 inhibition in aging: A systematic review",
    journal: "Nature Aging",
    year: "2024",
    summary: "Comprehensive analysis of rapamycin's effects on lifespan across species and early human trial data.",
  },
  {
    id: "2",
    title: "NAD+ precursors and their role in cellular metabolism",
    journal: "Cell Metabolism",
    year: "2024",
    summary: "Comparing bioavailability and efficacy of NMN, NR, and other NAD+ boosting compounds.",
  },
  {
    id: "3",
    title: "Senolytics: Targeting senescent cells for healthspan extension",
    journal: "Science",
    year: "2023",
    summary: "Review of senolytic compounds and their potential for clearing zombie cells.",
  },
  {
    id: "4",
    title: "Time-restricted eating and metabolic health markers",
    journal: "NEJM",
    year: "2024",
    summary: "Large-scale clinical trial examining effects of 16:8 fasting on biomarkers of aging.",
  },
];

export default function ResearchPage() {
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

          <div className={styles.papers}>
            {researchPapers.map((paper) => (
              <article key={paper.id} className={styles.paper}>
                <div className={styles.paperMeta}>
                  <span className={styles.journal}>{paper.journal}</span>
                  <span className={styles.year}>{paper.year}</span>
                </div>
                <h2 className={styles.paperTitle}>{paper.title}</h2>
                <p className={styles.paperSummary}>{paper.summary}</p>
                <a href="#" className={styles.readMore}>
                  Read analysis →
                </a>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
