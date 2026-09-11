import type { TopPodcastShow } from "@/app/page";
import styles from "./TopPodcastsSection.module.css";

interface TopPodcastsSectionProps {
  shows: TopPodcastShow[];
}

function handleArtworkError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/video.svg";
}

export default function TopPodcastsSection({ shows }: TopPodcastsSectionProps) {
  if (shows.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Top Podcasts</h2>

      <div className={styles.row}>
        {shows.map((show) => (
          <a key={show.id} href={show.href} target="_blank" rel="noopener noreferrer" className={styles.show}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={show.artworkUrl || "/images/placeholders/video.svg"}
              alt={show.name}
              className={styles.artwork}
              loading="lazy"
              onError={handleArtworkError}
            />
            <span className={styles.name}>{show.name}</span>
            {show.creator && <span className={styles.creator}>{show.creator}</span>}
          </a>
        ))}
      </div>
    </section>
  );
}
