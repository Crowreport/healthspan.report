"use client";

import { useState, useEffect } from "react";
import { Header, Footer } from "@/components/layout";
import type { RSSAPIResponse, RSSSource, RSSArticle } from "@/types/rss";
import styles from "./page.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResearchPaper {
  /** Unique identifier – the article's external URL */
  id: string;
  title: string;
  authors: string;
  source: string;
  publishedAt: string;
  year: string;
  summary: string;
  link: string;
  slug: string;
  categories?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Non-research content types to filter out.
 * These are common in academic journal feeds (Nature, Science, Cell, etc.)
 * and should not appear on the Research page.
 */
const NON_RESEARCH_CATEGORIES = new Set([
  "comment",
  "editorial",
  "news",
  "news & views",
  "news and views",
  "perspective",
  "perspectives",
  "publisher correction",
  "author correction",
  "correction",
  "corrections",
  "correspondence",
  "erratum",
  "matters arising",
  "reply",
  "addendum",
  "retraction",
  "world view",
  "book review",
  "obituary",
  "research highlight",
  "research highlights",
  "in brief",
]);

/**
 * Returns true when the article is a research item (i.e. none of its
 * categories match the non-research blocklist).  Articles without categories
 * are assumed to be research content (common for blog-style feeds).
 */
function isResearchContent(article: RSSArticle): boolean {
  if (!article.categories || article.categories.length === 0) return true;
  return !article.categories.some((cat) =>
    NON_RESEARCH_CATEGORIES.has(cat.toLowerCase().trim())
  );
}

/**
 * Map raw RSS sources into a flat, sorted list of ResearchPaper objects.
 */
function mapToResearchPapers(sources: RSSSource[]): ResearchPaper[] {
  const papers: ResearchPaper[] = [];

  for (const source of sources) {
    for (const article of source.articles) {
      if (!isResearchContent(article)) continue;

      const date = new Date(article.pubDate);

      papers.push({
        id: article.link,
        title: article.title,
        authors: article.creator || source.source.title,
        source: source.source.title,
        publishedAt: article.pubDate,
        year: isNaN(date.getTime()) ? "" : date.getFullYear().toString(),
        summary: article.contentSnippet || "",
        link: article.link,
        slug: slugify(article.title),
        categories: article.categories,
      });
    }
  }

  return papers.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResearchPage() {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResearch() {
      try {
        // Fetch research feeds (Nature Aging, etc.) and topic feeds
        // (Lifespan.io, Fight Aging!) which also cover research content.
        const [researchRes, topicRes] = await Promise.all([
          fetch("/api/rss?type=research"),
          fetch("/api/rss?type=topic"),
        ]);

        const allSources: RSSSource[] = [];

        if (researchRes.ok) {
          const data: RSSAPIResponse = await researchRes.json();
          allSources.push(...data.sources);
        }

        if (topicRes.ok) {
          const data: RSSAPIResponse = await topicRes.json();
          allSources.push(...data.sources);
        }

        if (allSources.length === 0) {
          throw new Error("No research feeds available");
        }

        const mappedPapers = mapToResearchPapers(allSources);
        setPapers(mappedPapers);
      } catch (err) {
        console.error("Failed to fetch research:", err);
        setError("Failed to load research papers. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchResearch();
  }, []);

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Research</h1>
            <p className={styles.subtitle}>
              Deep dives into the latest longevity research, clinical trials, and
              scientific breakthroughs.
            </p>
          </div>

          {isLoading ? (
            <div className={styles.papers}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skeleton}>
                  <div className={styles.skeletonMeta} />
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonSummary} />
                  <div className={styles.skeletonLink} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          ) : papers.length === 0 ? (
            <div className={styles.empty}>
              <p>No research papers available at the moment.</p>
            </div>
          ) : (
            <div className={styles.papers}>
              {papers.map((paper) => (
                <article key={paper.id} className={styles.paper}>
                  <div className={styles.paperMeta}>
                    <span className={styles.journal}>{paper.source}</span>
                    <span className={styles.year}>{paper.year}</span>
                  </div>
                  <h2 className={styles.paperTitle}>{paper.title}</h2>
                  {paper.authors && paper.authors !== paper.source && (
                    <p className={styles.paperAuthors}>{paper.authors}</p>
                  )}
                  {paper.summary && (
                    <p className={styles.paperSummary}>{paper.summary}</p>
                  )}
                  <a
                    href={paper.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.readMore}
                  >
                    Read analysis →
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
