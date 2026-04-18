import { Header, Footer } from "@/components/layout";
import { getVideosFromDB } from "@/lib/content/videos";
import { getCurrentUser } from "@/lib/auth";
import VideosGridWithEdit from "@/components/videos/VideosGridWithEdit";
import styles from "./page.module.css";

export default async function VideosPage() {
  const [user, { videos, error }] = await Promise.all([
    getCurrentUser(),
    getVideosFromDB(80),
  ]);
  const isAdmin = user?.role === "admin";

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

          {error ? (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          ) : videos.length === 0 ? (
            <div className={styles.empty}>
              <p>No videos available at the moment.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              <VideosGridWithEdit videos={videos} isAdmin={!!isAdmin} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
