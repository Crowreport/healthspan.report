"use client";

import { useEffect, useState } from "react";
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

        const response = await fetch("/api/rss");
        if (!response.ok) throw new Error("Failed to fetch feeds");

        const data: RSSAPIResponse = await response.json();
        if (!data.sources) {
          setArticles([]);
          setVideos([]);
          setIsLoading(false);
          return;
        }

        setArticles(mapRSSToArticles(data.sources, keywords));
        setVideos(mapRSSToVideos(data.sources, keywords));
      } catch (err) {
        console.error("Failed to fetch topic content:", err);
        setError("Failed to load content. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopicContent();
  }, [keywords]);

  const topicBadge = getTopicBadge(topicName, topicIcon);

  return (
    <div className={styles.container}>
      <header className={styles.headerPanel}>
        <div className={styles.topicHeader}>
          <span className={styles.icon}>{topicBadge}</span>
          <div>
            <h1 className={styles.title}>{topicName}</h1>
            <p className={styles.subtitle}>{topicDescription}</p>
          </div>
        </div>
      </header>

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
          <div className={styles.feedMeta}>
            <span className={styles.metaPill}>
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </span>
            <span className={styles.metaPill}>
              {videos.length} {videos.length === 1 ? "video" : "videos"}
            </span>
          </div>

          {articles.length === 0 && videos.length === 0 ? (
            <div className={styles.empty}>
              <p>No content found for this topic yet.</p>
              <p className={styles.emptySubtext}>Check back soon for new content.</p>
            </div>
          ) : (
            <div className={styles.contentWrapper}>
              <div className={styles.mainContent}>
                {articles.length > 0 && (
                  <section className={styles.sectionPanel}>
                    <div className={styles.sectionHeader}>
                      <h2 className={styles.sectionTitle}>Latest Articles</h2>
                      <p className={styles.sectionCount}>{articles.length} items</p>
                    </div>
                    <div className={styles.grid}>
                      {articles.slice(0, 8).map((article) => (
                        <ArticleCard key={article.id} article={article} />
                      ))}
                    </div>
                  </section>
                )}

                {videos.length > 0 && (
                  <section className={styles.sectionPanel}>
                    <div className={styles.sectionHeader}>
                      <h2 className={styles.sectionTitle}>Latest Videos</h2>
                      <p className={styles.sectionCount}>{videos.length} items</p>
                    </div>
                    <div className={styles.grid}>
                      {videos.slice(0, 8).map((video) => (
                        <VideoThumbnail key={video.id} video={video} />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className={styles.sidebar}>
                <div className={styles.sidebarPanel}>
                  <AdPlaceholder size="rectangle" />
                </div>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getTopicBadge(topicName: string, topicIcon: string): string {
  const cleanIcon = (topicIcon || "").trim();
  if (/^[A-Za-z0-9]{1,3}$/.test(cleanIcon)) return cleanIcon.toUpperCase();

  const parts = topicName
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "TP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
