import { Header, Footer } from "@/components/layout";
import { AdPlaceholder } from "@/components/ui";
import {
  HeroBanner,
  ArticleGrid,
  TrendingTopics,
  LatestVideos,
  TopChannels,
  TopPodcasts,
} from "@/components/sections";
import { getArticlesFromDB } from "@/lib/content/articles";
import { getVideosFromDB } from "@/lib/content/videos";
import { getCurrentUser } from "@/lib/auth";
import styles from "./page.module.css";

export default async function Home() {
  const [user, { articles }, { videos }] = await Promise.all([
    getCurrentUser(),
    getArticlesFromDB(6),
    getVideosFromDB(15),
  ]);
  const isAdmin = user?.role === "admin";

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        {/* Hero Section */}
        <HeroBanner />

        {/* Top Ad Banner */}
        <section className={styles.adSection}>
          <div className={styles.adContainer}>
            <AdPlaceholder size="leaderboard" />
          </div>
        </section>

        {/* Latest Articles (from DB) */}
        <ArticleGrid initialArticles={articles} isAdmin={!!isAdmin} />

        {/* Mid-page Ad */}
        <section className={styles.adSection}>
          <div className={styles.adContainer}>
            <AdPlaceholder size="leaderboard" />
          </div>
        </section>

        {/* Trending Topics */}
        <TrendingTopics />

        {/* Another Ad */}
        <section className={styles.adSection}>
          <div className={styles.adContainer}>
            <AdPlaceholder size="leaderboard" />
          </div>
        </section>

        {/* Latest Videos */}
        <LatestVideos initialVideos={videos} isAdmin={!!isAdmin} />

        {/* Top YouTube Channels */}
        <TopChannels />

        {/* Top Podcasts */}
        <TopPodcasts />
      </main>

      <Footer />
    </div>
  );
}
