import { CommentBubble, ReactionBar } from "@/components/ui";
import type { LibraryFolder, LibrarySavedVideo } from "@/lib/content/libraryTypes";
import styles from "./SavedVideoCard.module.css";

interface SavedVideoCardProps {
  video: LibrarySavedVideo;
  folders: LibraryFolder[];
  commentCount?: number;
  onUnsave: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
  onSummarize: (id: string) => void;
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
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

export default function SavedVideoCard({
  video,
  folders,
  commentCount,
  onUnsave,
  onMoveToFolder,
  onSummarize,
}: SavedVideoCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.thumb}>
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
        <button
          type="button"
          className={styles.bookmarkButton}
          onClick={() => onUnsave(video.id)}
          aria-pressed="true"
          aria-label="Remove from saved videos"
          title="Remove from saved videos"
        >
          <BookmarkIcon />
        </button>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{video.title}</h3>
        <span className={styles.channel}>{video.channelName}</span>

        <div className={styles.tagsRow}>
          {video.tags.length > 0 && (
            <div className={styles.tags}>
              {video.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <select
            className={styles.folderSelect}
            value={video.folderId ?? ""}
            onChange={(event) => onMoveToFolder(video.id, event.target.value || null)}
            aria-label="Move to folder"
          >
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.footer}>
          <div className={styles.engagement}>
            <ReactionBar itemId={video.id} />
            <CommentBubble count={commentCount} />
          </div>

          <button
            type="button"
            className={styles.summarizeButton}
            onClick={() => onSummarize(video.id)}
          >
            <SparkleIcon />
            Summarize
          </button>
        </div>
      </div>
    </article>
  );
}
