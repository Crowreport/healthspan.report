"use client";

import { useState } from "react";
import { ArticleCard, AdPlaceholder } from "@/components/ui";
import EditArticleModal from "@/components/articles/EditArticleModal";
import type { Article } from "@/types";
import styles from "./ArticleGrid.module.css";

interface ArticleGridProps {
  /** Articles from DB (server-fetched). When provided, no client fetch. */
  initialArticles?: Article[];
  /** When true, each article card shows an Edit button that opens the edit modal. */
  isAdmin?: boolean;
}

export default function ArticleGrid({ initialArticles = [], isAdmin = false }: ArticleGridProps) {
  const articles = initialArticles;
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Latest Research</h2>
          <a href="/articles" className={styles.viewAll}>
            View all articles
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
          <div className={styles.articles}>
            {articles.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.skeleton}>
                  <div className={styles.skeletonImage} />
                  <div className={styles.skeletonContent}>
                    <div className={styles.skeletonTitle} />
                    <div className={styles.skeletonExcerpt} />
                    <div className={styles.skeletonMeta} />
                  </div>
                </div>
              ))
            ) : (
              articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onEdit={isAdmin ? () => setEditingId(article.id) : undefined}
                />
              ))
            )}
          </div>
          <EditArticleModal
            articleId={editingId}
            isOpen={!!editingId}
            onClose={() => setEditingId(null)}
          />

          <aside className={styles.sidebar}>
            <AdPlaceholder size="rectangle" />
            <div className={styles.wellnessPreview}>
              <h3 className={styles.wellnessTitle}>Wellness Gallery</h3>
              <div className={styles.wellnessImages}>
                <div className={styles.wellnessImage}>
                  <span className={styles.imagePlaceholder}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </span>
                </div>
                <div className={styles.wellnessImage}>
                  <span className={styles.imagePlaceholder}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
