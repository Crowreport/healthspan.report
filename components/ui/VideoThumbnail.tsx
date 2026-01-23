import { Video } from "@/types";
import styles from "./VideoThumbnail.module.css";

interface VideoThumbnailProps {
  video: Video;
  variant?: "default" | "large";
}

export default function VideoThumbnail({
  video,
  variant = "default",
}: VideoThumbnailProps) {
  const hasImage =
    video.thumbnailUrl && !video.thumbnailUrl.includes("placeholder");

  return (
    <a
      href={video.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.thumbnail} ${styles[variant]}`}
    >
      <div className={styles.imageWrapper}>
        {hasImage ? (
          <div
            className={styles.image}
            style={{
              backgroundImage: `url(${video.thumbnailUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <span className={styles.playIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        ) : (
          <div
            className={styles.image}
            style={{
              background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
            }}
          >
            <span className={styles.playIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        )}
        {video.duration && (
          <span className={styles.duration}>{video.duration}</span>
        )}
      </div>

      <div className={styles.content}>
        <h4 className={styles.title}>{video.title}</h4>
        <div className={styles.meta}>
          <span className={styles.channel}>{video.channelName}</span>
          <span className={styles.stats}>
            {video.views && `${video.views} · `}{video.publishedAt}
          </span>
        </div>
      </div>
    </a>
  );
}
