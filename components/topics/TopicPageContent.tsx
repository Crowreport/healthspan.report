"use client";

import { useState, useEffect } from "react";
import { AdPlaceholder, ArticleCard, VideoThumbnail } from "@/components/ui";
import { mapRSSToArticles, mapRSSToVideos } from "@/lib/topics/filtering";
import type { Article, Video } from "@/types";
import type { RSSAPIResponse } from "@/types/rss";
import styles from "./TopicPageContent.module.css";

interface TopicPageContentProps {
  topicName: string;
  topicDescription: string;
  topicIcon: string;
  keywords: string[];
}

export default function TopicPageContent({
  topicName,
  topicDescription,
  topicIcon,
  keywords,
}: TopicPageContentProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopicContent() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all RSS feeds
        const response = await fetch("/api/rss");
        if (!response.ok) throw new Error("Failed to fetch feeds");

        const data: RSSAPIResponse = await response.json();
        if (!data.sources) {
          setArticles([]);
          setVideos([]);
          setIsLoading(false);
          return;
        }

        // Filter articles and videos by keywords
        const mappedArticles = mapRSSToArticles(data.sources, keywords);
        const mappedVideos = mapRSSToVideos(data.sources, keywords);

        setArticles(mappedArticles);
        setVideos(mappedVideos);
      } catch (err) {
        console.error("Failed to fetch topic content:", err);
        setError("Failed to load content. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopicContent();
  }, [keywords]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.topicHeader}>
          <span className={styles.icon}>{topicIcon}</span>
          <div>
            <h1 className={styles.title}>{topicName}</h1>
            <p className={styles.subtitle}>{topicDescription}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeleton}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonExcerpt} />
                <div className={styles.skeletonMeta} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className={styles.stats}>
            <span className={styles.count}>
              {articles.length} {articles.length === 1 ? "article" : "articles"} · {videos.length} {videos.length === 1 ? "video" : "videos"}
            </span>
          </div>

          {articles.length === 0 && videos.length === 0 ? (
            <div className={styles.empty}>
              <p>No content found for this topic yet.</p>
              <p className={styles.emptySubtext}>
                Check back soon for new content!
              </p>
            </div>
          ) : (
            <div className={styles.contentWrapper}>
              <div className={styles.mainContent}>
                {/* Latest Articles Section */}
                {articles.length > 0 && (
                  <section className={styles.contentSection}>
                    <h2 className={styles.sectionTitle}>Latest Articles</h2>
                    <div className={styles.grid}>
                      {articles.slice(0, 6).map((article) => (
                        <ArticleCard key={article.id} article={article} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Latest Videos Section */}
                {videos.length > 0 && (
                  <section className={styles.contentSection}>
                    <h2 className={styles.sectionTitle}>Latest Videos</h2>
                    <div className={styles.grid}>
                      {videos.slice(0, 6).map((video) => (
                        <VideoThumbnail key={video.id} video={video} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Remaining Content */}
                {(articles.length > 6 || videos.length > 6) && (
                  <section className={styles.contentSection}>
                    <h2 className={styles.sectionTitle}>More Content</h2>
                    <div className={styles.grid}>
                      {articles.slice(6).map((article) => (
                        <ArticleCard key={article.id} article={article} />
                      ))}
                      {videos.slice(6).map((video) => (
                        <VideoThumbnail key={video.id} video={video} />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className={styles.sidebar}>
                <AdPlaceholder size="rectangle" />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
