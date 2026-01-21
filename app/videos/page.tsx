import { Header, Footer } from "@/components/layout";
import { VideoThumbnail } from "@/components/ui";
import { latestVideos } from "@/data/mockData";
import styles from "./page.module.css";

export const metadata = {
  title: "Videos | Healthspan",
  description: "Watch the latest longevity and wellness videos from top creators.",
};

export default function VideosPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Videos</h1>
            <p className={styles.subtitle}>
              Curated videos from the best longevity researchers and health
              experts.
            </p>
          </div>

          <div className={styles.grid}>
            {latestVideos.map((video) => (
              <VideoThumbnail key={video.id} video={video} />
            ))}
            {/* Duplicate for demo */}
            {latestVideos.map((video) => (
              <VideoThumbnail key={`dup-${video.id}`} video={video} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
