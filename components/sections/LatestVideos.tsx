import { VideoThumbnail } from "@/components/ui";
import { latestVideos } from "@/data/mockData";
import styles from "./LatestVideos.module.css";

export default function LatestVideos() {
  const featured = latestVideos[0];
  const remaining = latestVideos.slice(1);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
              </svg>
            </span>
            <h2 className={styles.title}>Latest Videos</h2>
          </div>
          <a href="/videos" className={styles.viewAll}>
            View all videos
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <div className={styles.grid}>
          {/* Featured Video */}
          <div className={styles.featured}>
            <VideoThumbnail video={featured} variant="large" />
          </div>

          {/* Video Grid */}
          <div className={styles.videoGrid}>
            {remaining.map((video) => (
              <VideoThumbnail key={video.id} video={video} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
