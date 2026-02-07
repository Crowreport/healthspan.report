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
import styles from "./page.module.css";

export default function Home() {
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

        {/* Latest Articles */}
        <ArticleGrid />

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
