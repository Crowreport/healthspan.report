"use client";

import { useState, useEffect } from "react";
import { ArticleCard, AdPlaceholder } from "@/components/ui";
import { articles as mockArticles } from "@/data/mockData";
import { slugify, formatRelativeDate } from "@/lib/rss/rssFetcher";
import type { Article } from "@/types";
import type { RSSAPIResponse, RSSSource } from "@/types/rss";
import styles from "./ArticleGrid.module.css";

function mapRSSToArticles(sources: RSSSource[]): Article[] {
  const articles: Article[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      articles.push({
        id: item.link,
        title: item.title,
        excerpt: item.contentSnippet || "",
        category: source.source.title,
        author: item.creator || source.source.title,
        publishedAt: item.pubDate,
        readTime: "5 min read",
        imageUrl: item.thumbnail || "/images/placeholder-article.jpg",
        slug: slugify(item.title),
        externalUrl: item.link, // Link to original article
      });
    }
  }

  // Sort by date and limit to 6 articles
  return articles
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 6);
}

export default function ArticleGrid() {
  const [articles, setArticles] = useState<Article[]>(mockArticles);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch("/api/rss?type=article");
        if (!response.ok) throw new Error("Failed to fetch articles");

        const data: RSSAPIResponse = await response.json();
        const mappedArticles = mapRSSToArticles(data.sources);

        if (mappedArticles.length > 0) {
          setArticles(mappedArticles);
        }
        // If no articles, keep using mock data
      } catch (err) {
        console.error("Failed to fetch RSS articles:", err);
        setError("Using cached articles");
        // Keep mock data on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticles();
  }, []);

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
            {isLoading ? (
              // Loading skeleton
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
                <ArticleCard key={article.id} article={article} />
              ))
            )}
          </div>

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
