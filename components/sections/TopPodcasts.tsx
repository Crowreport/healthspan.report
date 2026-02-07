import { PodcastCard, AdPlaceholder } from "@/components/ui";
import { topPodcasts } from "@/data/mockData";
import styles from "./TopPodcasts.module.css";

export default function TopPodcasts() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Top Podcasts</h2>
          <p className={styles.subtitle}>
            Listen to these expert discussions on longevity, healthspan, and evidence-based wellness
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.podcasts}>
            {topPodcasts.map((podcast) => (
              <PodcastCard key={podcast.id} podcast={podcast} />
            ))}
          </div>

          <aside className={styles.sidebar}>
            <AdPlaceholder size="rectangle" />
          </aside>
        </div>
      </div>
    </section>
  );
}

