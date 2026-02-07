import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { trendingTopics } from "@/data/mockData";
import styles from "./page.module.css";

export const metadata = {
  title: "Topics | Healthspan",
  description: "Explore longevity topics including supplements, nutrition, fitness, and more.",
};

const allTopics = [
  { name: "Cellular Health", slug: "cellular-health", icon: "🧬" },
  { name: "Supplements", slug: "supplements", icon: "💊" },
  { name: "Nutrition", slug: "nutrition", icon: "🥗" },
  { name: "Fasting", slug: "fasting", icon: "⏰" },
  { name: "Exercise", slug: "exercise", icon: "🏃" },
  { name: "Sleep", slug: "sleep", icon: "😴" },
  { name: "Mental Health", slug: "mental-health", icon: "🧠" },
  { name: "Hormones", slug: "hormones", icon: "⚗️" },
  { name: "Protocols", slug: "protocols", icon: "📋" },
  { name: "Research", slug: "research", icon: "🔬" },
  { name: "Biomarkers", slug: "biomarkers", icon: "📊" },
  { name: "Genetics", slug: "genetics", icon: "🧪" },
];

export default function TopicsPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Topics</h1>
            <p className={styles.subtitle}>
              Explore our comprehensive coverage of longevity and wellness topics.
            </p>
          </div>

          <div className={styles.grid}>
            {allTopics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/topics/${topic.slug}`}
                className={styles.topicCard}
              >
                <span className={styles.icon}>{topic.icon}</span>
                <h3 className={styles.topicName}>{topic.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
