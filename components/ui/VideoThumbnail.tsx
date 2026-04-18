import Link from "next/link";
import { Video } from "@/types";
import styles from "./VideoThumbnail.module.css";

interface VideoThumbnailProps {
  video: Video;
  variant?: "default" | "large";
  /** When set, shows an Edit button (for admins). */
  onEdit?: () => void;
}

export default function VideoThumbnail({
  video,
  variant = "default",
  onEdit,
}: VideoThumbnailProps) {
  const hasImage =
    video.thumbnailUrl && !video.thumbnailUrl.includes("/images/placeholders/");
  const discussionHref = video.slug ? `/videos/${video.slug}/discussion` : null;

  return (
    <article className={`${styles.thumbnail} ${styles[variant]}`}>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          className={styles.editButton}
          aria-label="Edit video"
        >
          Edit
        </button>
      )}
      {discussionHref && (
        <Link
          href={discussionHref}
          className={styles.commentLink}
          onClick={(e) => e.stopPropagation()}
          aria-label="Open comments"
          title="Comments"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
        </Link>
      )}
      <a
        href={video.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
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
              {video.views && `${video.views} · `}
              {video.publishedAt}
            </span>
          </div>
        </div>
      </a>
    </article>
  );
}
