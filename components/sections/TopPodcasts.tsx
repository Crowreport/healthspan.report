import { PodcastCard, Carousel } from "@/components/ui";
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

        <Carousel>
          {topPodcasts.map((podcast) => (
            <PodcastCard key={podcast.id} podcast={podcast} />
          ))}
        </Carousel>
      </div>
    </section>
  );
}

