"use client";

import { useEffect, useMemo, useState } from "react";
import { Header, Footer } from "@/components/layout";
import { EditorialPageIntro } from "@/components/ui";
import type { RSSAPIResponse, RSSSource, RSSArticle } from "@/types/rss";
import styles from "./page.module.css";

interface ResearchPaper {
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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

function isResearchContent(article: RSSArticle): boolean {
  if (!article.categories || article.categories.length === 0) return true;
  return !article.categories.some((cat) =>
    NON_RESEARCH_CATEGORIES.has(cat.toLowerCase().trim())
  );
}

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
        year: Number.isNaN(date.getTime()) ? "" : date.getFullYear().toString(),
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

export default function ResearchPage() {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResearch() {
      try {
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

        setPapers(mapToResearchPapers(allSources));
      } catch (err) {
        console.error("Failed to fetch research:", err);
        setError("Failed to load research papers. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchResearch();
  }, []);

  const sourceCount = useMemo(
    () => new Set(papers.map((paper) => paper.source)).size,
    [papers]
  );

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <EditorialPageIntro
            badge="Evidence Feed"
            title="Research"
            description="Deep dives into longevity studies, clinical findings, and peer-reviewed breakthroughs."
          />

          {!isLoading && !error && papers.length > 0 && (
            <div className={styles.feedMeta}>
              <span className={styles.metaPill}>{papers.length} papers</span>
              <span className={styles.metaPill}>{sourceCount} sources</span>
              <span className={styles.metaPill}>
                Updated {formatDate(papers[0].publishedAt)}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className={styles.papers}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={styles.skeleton}>
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
            <section className={styles.sectionPanel}>
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
                      Open source
                    </a>
                  </article>
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
