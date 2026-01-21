import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { trendingTopics } from "@/data/mockData";
import styles from "./page.module.css";

export const metadata = {
  title: "Topics | Healthspan",
  description: "Explore longevity topics including supplements, nutrition, fitness, and more.",
};

const allTopics = [
  { name: "Cellular Health", slug: "cellular-health", count: 24, icon: "🧬" },
  { name: "Supplements", slug: "supplements", count: 42, icon: "💊" },
  { name: "Nutrition", slug: "nutrition", count: 38, icon: "🥗" },
  { name: "Fasting", slug: "fasting", count: 19, icon: "⏰" },
  { name: "Exercise", slug: "exercise", count: 31, icon: "🏃" },
  { name: "Sleep", slug: "sleep", count: 15, icon: "😴" },
  { name: "Mental Health", slug: "mental-health", count: 22, icon: "🧠" },
  { name: "Hormones", slug: "hormones", count: 18, icon: "⚗️" },
  { name: "Protocols", slug: "protocols", count: 12, icon: "📋" },
  { name: "Research", slug: "research", count: 56, icon: "🔬" },
  { name: "Biomarkers", slug: "biomarkers", count: 27, icon: "📊" },
  { name: "Genetics", slug: "genetics", count: 14, icon: "🧪" },
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
                <span className={styles.count}>{topic.count} articles</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
