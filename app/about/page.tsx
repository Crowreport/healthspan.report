import { Header, Footer } from "@/components/layout";
import { Button, EditorialPageIntro } from "@/components/ui";
import styles from "./page.module.css";

export const metadata = {
  title: "About | Healthspan",
  description:
    "Learn about Healthspan and our mission to extend healthy human lifespan.",
};

const coverageAreas = [
  {
    code: "CH",
    title: "Cellular Health",
    description:
      "Aging biology, senescence, mitochondrial performance, and repair pathways.",
  },
  {
    code: "NU",
    title: "Nutrition",
    description:
      "Fasting protocols, dietary patterns, and evidence-backed nutrition strategy.",
  },
  {
    code: "EX",
    title: "Exercise",
    description:
      "Longevity training, zone 2 conditioning, strength, and recovery frameworks.",
  },
  {
    code: "IN",
    title: "Interventions",
    description:
      "Supplements, pharmaceuticals, and policy updates around lifespan science.",
  },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <EditorialPageIntro
            badge="About Healthspan"
            title="A Publication Focused on Healthspan Research"
            description="We track and organize high-signal longevity reporting so readers can discover trusted science, practical protocols, and emerging breakthroughs without the noise."
          />

          <section className={styles.panel}>
            <div className={styles.mission}>
              <h2 className={styles.sectionTitle}>Our Mission</h2>
              <p className={styles.sectionText}>
                Longevity science moves quickly. We curate the most relevant
                studies, expert analysis, and source-linked updates in a
                publication-first format designed for discovery and ongoing
                learning.
              </p>
            </div>

            <div className={styles.coverageGrid}>
              {coverageAreas.map((area) => (
                <article key={area.title} className={styles.topicCard}>
                  <span className={styles.topicIcon}>{area.code}</span>
                  <h3 className={styles.topicTitle}>{area.title}</h3>
                  <p className={styles.topicText}>{area.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.ctaPanel}>
            <h2 className={styles.ctaTitle}>Stay Updated</h2>
            <p className={styles.ctaText}>
              Get weekly healthspan research highlights, new videos, and top
              stories.
            </p>
            <Button>Subscribe to Newsletter</Button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
