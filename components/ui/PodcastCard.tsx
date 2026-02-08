import { Podcast } from "@/types";
import styles from "./PodcastCard.module.css";

interface PodcastCardProps {
  podcast: Podcast;
}

export default function PodcastCard({ podcast }: PodcastCardProps) {
  return (
    <a
      href={podcast.podcastUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
    >
      <div className={styles.image}>
        <div
          className={styles.imagePlaceholder}
          style={{
            background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)`,
          }}
        >
          <span className={styles.initial}>{podcast.name.charAt(0)}</span>
        </div>
      </div>

      <div className={styles.content}>
        <h4 className={styles.name}>{podcast.name}</h4>
        <p className={styles.description}>{podcast.description}</p>
        <div className={styles.meta}>
          <span className={styles.publisher}>{podcast.publisher}</span>
        </div>
        <div className={styles.stats}>
          <span className={styles.views}>{podcast.views}</span>
          <span className={styles.duration}>{podcast.duration}</span>
        </div>
      </div>

      <div className={styles.playIcon}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </a>
  );
}

