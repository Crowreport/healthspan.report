import Link from "next/link";
import { trendingTopics } from "@/data/mockData";
import styles from "./TrendingTopics.module.css";

export default function TrendingTopics() {
  const featured = trendingTopics.find((t) => t.isFeatured);
  const regular = trendingTopics.filter((t) => !t.isFeatured);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Trending Topics</h2>
        </div>

        <div className={styles.grid}>
          {/* Featured Topic */}
          {featured && (
            <Link
              href={`/topics/${featured.slug}`}
              className={styles.featured}
            >
              <div className={styles.featuredImage}>
                <span className={styles.imagePlaceholder}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </span>
              </div>
              <div className={styles.featuredContent}>
                <span className={styles.category}>{featured.category}</span>
                <h3 className={styles.featuredTitle}>{featured.title}</h3>
                <p className={styles.featuredExcerpt}>{featured.excerpt}</p>
              </div>
            </Link>
          )}

          {/* Regular Topics */}
          <div className={styles.regularTopics}>
            {regular.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className={styles.topicCard}
              >
                <div className={styles.topicImage}>
                  <span className={styles.imagePlaceholder}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </span>
                </div>
                <div className={styles.topicContent}>
                  <span className={styles.topicCategory}>{topic.category}</span>
                  <h4 className={styles.topicTitle}>{topic.title}</h4>
                  <p className={styles.topicExcerpt}>{topic.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
