import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { EditorialPageIntro } from "@/components/ui";
import styles from "./page.module.css";

export const metadata = {
  title: "Topics | Healthspan",
  description: "Explore longevity topics including supplements, nutrition, fitness, and more.",
};

const allTopics = [
  { name: "Cellular Health", slug: "cellular-health", badge: "CH" },
  { name: "Supplements", slug: "supplements", badge: "SP" },
  { name: "Nutrition", slug: "nutrition", badge: "NU" },
  { name: "Fasting", slug: "fasting", badge: "FA" },
  { name: "Exercise", slug: "exercise", badge: "EX" },
  { name: "Sleep", slug: "sleep", badge: "SL" },
  { name: "Mental Health", slug: "mental-health", badge: "MH" },
  { name: "Hormones", slug: "hormones", badge: "HO" },
  { name: "Protocols", slug: "protocols", badge: "PR" },
  { name: "Research", slug: "research", badge: "RE" },
  { name: "Biomarkers", slug: "biomarkers", badge: "BI" },
  { name: "Genetics", slug: "genetics", badge: "GE" },
];

export default function TopicsPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <EditorialPageIntro
            badge="Topic Index"
            title="Topics"
            description="Explore focused healthspan coverage areas, from cellular aging to practical protocols."
          />

          <section className={styles.panel}>
            <div className={styles.grid}>
              {allTopics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topics/${topic.slug}`}
                  className={styles.topicCard}
                >
                  <span className={styles.icon}>{topic.badge}</span>
                  <h3 className={styles.topicName}>{topic.name}</h3>
                  <span className={styles.count}>Explore coverage</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
