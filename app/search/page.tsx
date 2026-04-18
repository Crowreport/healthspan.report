"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import type { RSSAPIResponse } from "@/types/rss";
import {
  mapSourcesToSearchItems,
  normalizeSearchQuery,
  searchItems,
  type SearchItem,
} from "@/utils/searchUtils";
import styles from "./page.module.css";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get("q") || "";
  const query = rawQuery.trim();
  const normalizedQuery = normalizeSearchQuery(query);

  const [indexItems, setIndexItems] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSearchIndex() {
      setIsLoading(true);
      setError(null);

      try {
        const [articleResponse, videoResponse] = await Promise.all([
          fetch("/api/rss?type=article"),
          fetch("/api/rss?type=video"),
        ]);

        const nextItems: SearchItem[] = [];

        if (articleResponse.ok) {
          const payload = (await articleResponse.json()) as RSSAPIResponse;
          nextItems.push(...mapSourcesToSearchItems(payload.sources || [], "article"));
        }

        if (videoResponse.ok) {
          const payload = (await videoResponse.json()) as RSSAPIResponse;
          nextItems.push(...mapSourcesToSearchItems(payload.sources || [], "video"));
        }

        if (!isCancelled) {
          setIndexItems(nextItems);
        }
      } catch (fetchError) {
        console.error("Failed to load search content:", fetchError);
        if (!isCancelled) {
          setError("Search is currently unavailable. Please try again in a moment.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSearchIndex();

    return () => {
      isCancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }
    return searchItems(indexItems, normalizedQuery, 120);
  }, [indexItems, normalizedQuery]);

  const articleCount = useMemo(
    () => results.filter((item) => item.type === "article").length,
    [results]
  );
  const videoCount = results.length - articleCount;

  const recommended = useMemo(() => indexItems.slice(0, 12), [indexItems]);

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <p className={styles.badge}>Search Results</p>
            <h1 className={styles.title}>
              {query ? `Results for "${query}"` : "Search Articles and Videos"}
            </h1>
            <p className={styles.subtitle}>
              Discover the latest healthspan reporting across articles and videos.
            </p>
          </section>

          {query && !isLoading && !error && (
            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{results.length} total matches</span>
              <span className={styles.metaPill}>{articleCount} articles</span>
              <span className={styles.metaPill}>{videoCount} videos</span>
            </div>
          )}

          {isLoading ? (
            <section className={styles.resultsGrid}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className={styles.skeleton} />
              ))}
            </section>
          ) : error ? (
            <section className={styles.emptyState}>
              <p>{error}</p>
            </section>
          ) : !query ? (
            <section className={styles.recommendedSection}>
              <h2 className={styles.sectionTitle}>Recommended Right Now</h2>
              <div className={styles.resultsGrid}>
                {recommended.map((item) => (
                  <SearchResultCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          ) : results.length === 0 ? (
            <section className={styles.emptyState}>
              <p>
                No matches found for <strong>{query}</strong>. Try another keyword.
              </p>
            </section>
          ) : (
            <section className={styles.recommendedSection}>
              <h2 className={styles.sectionTitle}>Matching Content</h2>
              <div className={styles.resultsGrid}>
                {results.map((item) => (
                  <SearchResultCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SearchPageFallback() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <p className={styles.badge}>Search Results</p>
            <h1 className={styles.title}>Loading search...</h1>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SearchResultCard({ item }: { item: SearchItem }) {
  const isExternal = /^https?:\/\//i.test(item.href);

  return (
    <a
      href={item.href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={styles.card}
    >
      <div className={styles.imageWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.title} className={styles.image} loading="lazy" />
      </div>
      <div className={styles.cardBody}>
        <span
          className={`${styles.typePill} ${
            item.type === "article" ? styles.articlePill : styles.videoPill
          }`}
        >
          {item.type === "article" ? "Article" : "Video"}
        </span>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <p className={styles.cardSummary}>{item.summary}</p>
        <p className={styles.cardMeta}>
          <span>{item.sourceName}</span>
          <span>|</span>
          <span>{item.publishedLabel}</span>
        </p>
      </div>
    </a>
  );
}
