import type { LibrarySavedVideo } from "@/lib/content/libraryMock";
import styles from "./SavedVideoCard.module.css";

interface SavedVideoCardProps {
  video: LibrarySavedVideo;
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.9L12 3z" />
    </svg>
  );
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/video.svg";
}

export default function SavedVideoCard({ video }: SavedVideoCardProps) {
  return (
    <article className={styles.card}>
      <a href={video.videoUrl} className={styles.thumbLink}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnailUrl || "/images/placeholders/video.svg"}
          alt={video.title}
          className={styles.thumbImage}
          loading="lazy"
          onError={handleImageError}
        />
        <span className={styles.duration}>{video.duration}</span>
      </a>

      <div className={styles.body}>
        <h3 className={styles.title}>{video.title}</h3>
        <span className={styles.channel}>{video.channelName}</span>

        {video.tags.length > 0 && (
          <div className={styles.tags}>
            {video.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.summarizeButton}
          disabled
          title="AI summaries are coming in Week 5"
        >
          <SparkleIcon />
          Summarize
        </button>
      </div>
    </article>
  );
}
