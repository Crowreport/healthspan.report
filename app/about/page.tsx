import { Header, Footer } from "@/components/layout";
import { Button } from "@/components/ui";
import styles from "./page.module.css";

export const metadata = {
  title: "About | Healthspan",
  description: "Learn about Healthspan and our mission to extend healthy human lifespan.",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.hero}>
            <h1 className={styles.title}>
              Extending Human <span className={styles.highlight}>Healthspan</span>
            </h1>
            <p className={styles.subtitle}>
              We're on a mission to make longevity science accessible to everyone.
              By curating the best research, insights, and expert content, we help
              you make informed decisions about your health and longevity.
            </p>
          </div>

          <div className={styles.sections}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Our Mission</h2>
              <p className={styles.sectionText}>
                The science of longevity is advancing rapidly, but staying informed
                can be overwhelming. We sift through the noise to bring you
                evidence-based insights that actually matter for extending your
                healthy years.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>What We Cover</h2>
              <div className={styles.topics}>
                <div className={styles.topic}>
                  <span className={styles.topicIcon}>🧬</span>
                  <h3 className={styles.topicTitle}>Cellular Health</h3>
                  <p className={styles.topicText}>
                    Senescence, NAD+, mitochondrial function, and cellular repair
                    mechanisms.
                  </p>
                </div>
                <div className={styles.topic}>
                  <span className={styles.topicIcon}>🥗</span>
                  <h3 className={styles.topicTitle}>Nutrition</h3>
                  <p className={styles.topicText}>
                    Fasting protocols, caloric restriction, and longevity-promoting
                    diets.
                  </p>
                </div>
                <div className={styles.topic}>
                  <span className={styles.topicIcon}>🏃</span>
                  <h3 className={styles.topicTitle}>Exercise</h3>
                  <p className={styles.topicText}>
                    Optimal training for longevity, Zone 2, strength, and mobility.
                  </p>
                </div>
                <div className={styles.topic}>
                  <span className={styles.topicIcon}>💊</span>
                  <h3 className={styles.topicTitle}>Interventions</h3>
                  <p className={styles.topicText}>
                    Supplements, pharmaceuticals, and emerging longevity therapies.
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.cta}>
              <h2 className={styles.ctaTitle}>Stay Updated</h2>
              <p className={styles.ctaText}>
                Join thousands of readers getting weekly longevity insights.
              </p>
              <Button>Subscribe to Newsletter</Button>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
