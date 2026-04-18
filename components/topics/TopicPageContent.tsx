"use client";

import { useState } from "react";
import { AdPlaceholder, ArticleCard, VideoThumbnail } from "@/components/ui";
import EditArticleModal from "@/components/articles/EditArticleModal";
import type { Article, Video } from "@/types";
import styles from "./TopicPageContent.module.css";

interface TopicPageContentProps {
  topicName: string;
  topicDescription: string;
  topicIcon: string;
  keywords: string[];
  /** Server-fetched, keyword-filtered content from DB. */
  initialArticles?: Article[];
  initialVideos?: Video[];
  isAdmin?: boolean;
}

export default function TopicPageContent({
  topicName,
  topicDescription,
  topicIcon,
  initialArticles,
  initialVideos,
  isAdmin = false,
}: TopicPageContentProps) {
  const articles = initialArticles ?? [];
  const videos = initialVideos ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);

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
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onEdit={isAdmin ? () => setEditingId(article.id) : undefined}
                    />
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
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onEdit={isAdmin ? () => setEditingId(article.id) : undefined}
                    />
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
      <EditArticleModal
        articleId={editingId}
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
