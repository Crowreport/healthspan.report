"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { ArticleCard, EditorialPageIntro } from "@/components/ui";
import { slugify } from "@/lib/rss/rssFetcher";
import type { Article } from "@/types";
import type { RSSAPIResponse, RSSSource } from "@/types/rss";
import styles from "./page.module.css";

function getSourcePlaceholder(sourceUrl: string, sourceName: string): string {
  const url = sourceUrl.toLowerCase();
  const name = sourceName.toLowerCase();

  if (url.includes("peterattiamd.com") || name.includes("peter attia")) {
    return "/images/placeholders/attia.png";
  }
  if (
    url.includes("longevity.technology") ||
    name.includes("longevity.technology")
  ) {
    return "/images/placeholders/longevity.png";
  }
  return "/images/placeholders/NOVOSLabs.png";
}

function mapRSSToArticles(sources: RSSSource[]): Article[] {
  const articles: Article[] = [];

  for (const source of sources) {
    const sourcePlaceholder = getSourcePlaceholder(
      source.source.link || "",
      source.source.title || ""
    );

    for (const item of source.articles) {
      const imageUrl = item.thumbnail || sourcePlaceholder;

      articles.push({
        id: item.link,
        title: item.title,
        excerpt: item.contentSnippet || "",
        category: source.source.title,
        author: item.creator || source.source.title,
        sourceName: source.source.title,
        publishedAt: item.pubDate,
        readTime: estimateReadTime(item.contentSnippet || item.title),
        imageUrl,
        slug: slugify(item.title),
        externalUrl: item.link,
      });
    }
  }

  return articles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch("/api/rss?type=article");
        if (!response.ok) throw new Error("Failed to fetch articles");

        const data: RSSAPIResponse = await response.json();
        setArticles(mapRSSToArticles(data.sources));
      } catch (err) {
        console.error("Failed to fetch RSS articles:", err);
        setError("Failed to load articles. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticles();
  }, []);

  const leadStory = articles[0];
  const remainingStories = useMemo(() => articles.slice(1), [articles]);
  const sourceCount = useMemo(
    () =>
      new Set(
        articles.map((article) => article.sourceName || article.category || article.author)
      ).size,
    [articles]
  );

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <EditorialPageIntro
            badge="Research Feed"
            title="Articles"
            description="Daily healthspan reporting with source-first coverage and quick-read metadata."
          />

          {!isLoading && !error && articles.length > 0 && (
            <div className={styles.feedMeta}>
              <span className={styles.metaPill}>{articles.length} stories</span>
              <span className={styles.metaPill}>{sourceCount} sources</span>
              <span className={styles.metaPill}>
                Updated {formatDate(articles[0].publishedAt)}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className={styles.grid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          ) : articles.length === 0 ? (
            <div className={styles.empty}>
              <p>No articles available at the moment.</p>
            </div>
          ) : (
            <>
              {leadStory && (
                <section className={styles.leadSection}>
                  <div className={styles.leadHeader}>
                    <p className={styles.sectionEyebrow}>Lead Story</p>
                  </div>
                  <div className={styles.leadGrid}>
                    <div className={styles.leadContent}>
                      <h2 className={styles.leadTitle}>
                        {leadStory.externalUrl ? (
                          <a
                            href={leadStory.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.leadTitleLink}
                          >
                            {leadStory.title}
                          </a>
                        ) : (
                          <Link
                            href={`/articles/${leadStory.slug}`}
                            className={styles.leadTitleLink}
                          >
                            {leadStory.title}
                          </Link>
                        )}
                      </h2>
                      {leadStory.excerpt && (
                        <p className={styles.leadExcerpt}>{leadStory.excerpt}</p>
                      )}
                      <p className={styles.leadMeta}>
                        <span>{leadStory.sourceName || leadStory.author || leadStory.category}</span>
                        <span className={styles.dot}>|</span>
                        <span>{formatDate(leadStory.publishedAt)}</span>
                        <span className={styles.dot}>|</span>
                        <span>{leadStory.readTime}</span>
                      </p>
                      {leadStory.externalUrl ? (
                        <a
                          href={leadStory.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.readLink}
                        >
                          Read full story
                        </a>
                      ) : (
                        <Link href={`/articles/${leadStory.slug}`} className={styles.readLink}>
                          Read full story
                        </Link>
                      )}
                    </div>
                    <div className={styles.leadCardWrap}>
                      <ArticleCard article={leadStory} />
                    </div>
                  </div>
                </section>
              )}

              <section>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Latest Coverage</h2>
                  <p className={styles.sectionCount}>{remainingStories.length} stories</p>
                </div>
                <div className={styles.grid}>
                  {remainingStories.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(5, Math.ceil(words / 170));
  return `~${minutes} min read`;
}

function formatDate(rawDate: string): string {
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
