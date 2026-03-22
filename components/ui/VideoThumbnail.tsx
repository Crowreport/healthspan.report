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
    video.thumbnailUrl && !video.thumbnailUrl.includes("/images/placeholders/");

  return (
    <a
      href={video.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.thumbnail} ${styles[variant]}`}
    >
      <div className={styles.imageWrap}>
        {hasImage ? (
          <div
            className={styles.image}
            style={{
              backgroundImage: `url(${video.thumbnailUrl})`,
            }}
          />
        ) : (
          <div className={styles.image} />
        )}
      </div>
      <div className={styles.content}>
        <h4 className={styles.title}>{video.title}</h4>
        <p className={styles.meta}>{formatDate(video.publishedAt)}</p>
      </div>
    </a>
  );
}

function formatDate(rawDate: string): string {
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
