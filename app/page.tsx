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
import { getTopicItemsForTrending } from "@/lib/content/topics";
import { getCurrentUser } from "@/lib/auth";
import styles from "./page.module.css";

export default async function Home() {
  const [user, { articles }, { topics }] = await Promise.all([
    getCurrentUser(),
    getArticlesFromDB(6),
    getTopicItemsForTrending(6),
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
        <TrendingTopics initialTopics={topics} isAdmin={!!isAdmin} />

        {/* Another Ad */}
        <section className={styles.adSection}>
          <div className={styles.adContainer}>
            <AdPlaceholder size="leaderboard" />
          </div>
        </section>

        {/* Latest Videos */}
        <LatestVideos />

        {/* Top YouTube Channels */}
        <TopChannels />

        {/* Top Podcasts */}
        <TopPodcasts />
      </main>

      <Footer />
    </div>
  );
}
