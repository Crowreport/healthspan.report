"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { articles, latestVideos } from "@/data/mockData";
import type { RSSAPIResponse, RSSSource } from "@/types/rss";
import styles from "./page.module.css";

type HomeVideo = {
  id: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  publishedAt: string;
  duration: string;
  videoUrl: string;
};

type HomeArticle = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readTime: string;
  imageUrl: string;
  externalUrl: string;
};

function CommentIcon() {
  return (
    <svg
      className={styles.commentIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function Home() {
  const [videoItems, setVideoItems] = useState<HomeVideo[]>(createFallbackVideos());
  const [articleItems, setArticleItems] = useState<HomeArticle[]>(createFallbackArticles());
  const videoFilters = ["For You", "Latest", "Research", "Interviews", "Podcasts"];

  useEffect(() => {
    let isCancelled = false;

    async function hydrateHomepageLinks() {
      try {
        const [videoResponse, articleResponse] = await Promise.all([
          fetch("/api/rss?type=video"),
          fetch("/api/rss?type=article"),
        ]);

        if (!isCancelled && videoResponse.ok) {
          const videoPayload = (await videoResponse.json()) as RSSAPIResponse;
          const mappedVideos = mapVideoSources(videoPayload.sources || []);
          if (mappedVideos.length > 0) {
            setVideoItems(mappedVideos);
          }
        }

        if (!isCancelled && articleResponse.ok) {
          const articlePayload = (await articleResponse.json()) as RSSAPIResponse;
          const mappedArticles = mapArticleSources(articlePayload.sources || []);
          if (mappedArticles.length > 0) {
            setArticleItems(mappedArticles);
          }
        }
      } catch (error) {
        console.error("Homepage feed hydration failed:", error);
      }
    }

    hydrateHomepageLinks();

    return () => {
      isCancelled = true;
    };
  }, []);

  const featuredVideo = videoItems[0] || createFallbackVideos()[0];
  const sideVideos = useMemo(() => {
    const base = videoItems.length > 1 ? videoItems.slice(1) : videoItems;
    return loopItems(base, 6);
  }, [videoItems]);

  const trendingColumns = useMemo(
    () =>
      Array.from({ length: 3 }, (_, columnIndex) =>
        loopItems(articleItems, 6, columnIndex)
      ),
    [articleItems]
  );

  const lifestyleStories = useMemo(() => loopItems(articleItems, 4), [articleItems]);

  const featuredVideoHref = normalizeHref(featuredVideo.videoUrl, "/videos");
  const featuredVideoExternal = isExternalHref(featuredVideoHref);

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Featured Video</h2>
              <Link href="/videos" className={styles.viewAll}>
                View all videos
              </Link>
            </div>
            <div className={styles.videoFilters} aria-label="Video feed filters">
              {videoFilters.map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  className={`${styles.videoFilter} ${
                    index === 0 ? styles.videoFilterActive : ""
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className={styles.featuredVideoLayout}>
              <div className={styles.playerColumn}>
                <a
                  href={featuredVideoHref}
                  target={featuredVideoExternal ? "_blank" : undefined}
                  rel={featuredVideoExternal ? "noopener noreferrer" : undefined}
                  className={styles.featuredHero}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredVideo.thumbnailUrl}
                    alt={featuredVideo.title}
                    className={styles.featuredImage}
                    loading="eager"
                  />
                  <div className={styles.playBadge} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </a>

                <div className={styles.playerMeta}>
                  <h3 className={styles.playerTitle}>{featuredVideo.title}</h3>
                  <p className={styles.playerSubline}>
                    {featuredVideo.channelName}
                    <span>|</span>
                    {featuredVideo.publishedAt}
                  </p>
                </div>
              </div>

              <aside className={styles.upNextPanel} aria-label="Up next videos">
                <p className={styles.upNextHeading}>Up next</p>
                {sideVideos.map((video, index) => {
                  const href = normalizeHref(video.videoUrl, "/videos");
                  const isExternal = isExternalHref(href);

                  return (
                    <a
                      key={`${video.id}-${index}`}
                      href={href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className={styles.upNextItem}
                    >
                      <div className={styles.upNextThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className={styles.thumbImage}
                          loading="lazy"
                        />
                        {video.duration && (
                          <span className={styles.upNextDuration}>{video.duration}</span>
                        )}
                      </div>
                      <div className={styles.upNextMeta}>
                        <h4>{video.title}</h4>
                        <p>{video.channelName}</p>
                        <p>{video.publishedAt}</p>
                      </div>
                    </a>
                  );
                })}
              </aside>
            </div>
          </section>

          <div className={styles.adBanner}>Advertisement</div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Trending Topics</h2>
              <Link href="/topics" className={styles.viewAll}>
                View all
              </Link>
            </div>

            <div className={styles.trendingColumns}>
              {trendingColumns.map((column, columnIndex) => (
                <div
                  key={`column-${columnIndex}`}
                  className={`${styles.topicColumn} ${
                    columnIndex === 1 ? styles.topicColumnAlt : ""
                  }`}
                >
                  {column.map((article, rowIndex) => {
                    const href = normalizeHref(article.externalUrl, "/articles");
                    const isExternal = isExternalHref(href);

                    return (
                      <a
                        key={`${article.id}-${columnIndex}-${rowIndex}`}
                        href={href}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        className={styles.topicRow}
                      >
                        <div className={styles.topicThumb}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={article.imageUrl}
                            alt={article.title}
                            className={styles.thumbImage}
                            loading="lazy"
                          />
                        </div>
                        <div className={styles.topicMeta}>
                          <h4>{article.title}</h4>
                          <p>
                            {formatDate(article.publishedAt)}
                            <span>|</span>
                            {article.readTime}
                          </p>
                        </div>
                        <CommentIcon />
                      </a>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <div className={styles.adBanner}>Advertisement</div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Lifestyle News</h2>
              <Link href="/articles" className={styles.viewAll}>
                Browse all
              </Link>
            </div>

            <div className={styles.lifestyleGrid}>
              {lifestyleStories.map((story, index) => {
                const href = normalizeHref(story.externalUrl, "/articles");
                const isExternal = isExternalHref(href);

                return (
                  <a
                    key={`${story.id}-life-${index}`}
                    href={href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className={styles.lifestyleCard}
                  >
                    <div className={styles.lifestyleImage}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={story.imageUrl}
                        alt={story.title}
                        className={styles.thumbImage}
                        loading="lazy"
                      />
                    </div>
                    <div className={styles.lifestyleContent}>
                      <h3>{story.title}</h3>
                      <p>{story.excerpt}</p>
                      <span className={styles.lifestyleMeta}>
                        {formatDate(story.publishedAt)} | {story.readTime}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function loopItems<T>(items: T[], count: number, start = 0): T[] {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length]);
}

function normalizeHref(rawHref: string, fallback: string): string {
  if (!rawHref) return fallback;
  if (/^https?:\/\//i.test(rawHref)) return rawHref;
  if (rawHref.startsWith("/")) return rawHref;
  if (rawHref.includes("youtube.com") || rawHref.includes("youtu.be")) {
    return `https://${rawHref.replace(/^\/+/, "")}`;
  }
  return fallback;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function mapVideoSources(sources: RSSSource[]): HomeVideo[] {
  const videos: HomeVideo[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      videos.push({
        id: item.link || `${source.source.feedUrl}-${item.title}`,
        title: item.title || "Untitled video",
        thumbnailUrl:
          item.thumbnail || source.source.image || "/images/placeholders/video.svg",
        channelName: source.source.title,
        publishedAt: formatDate(item.pubDate),
        duration: "",
        videoUrl: item.link || "/videos",
      });
    }
  }

  return videos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function mapArticleSources(sources: RSSSource[]): HomeArticle[] {
  const stories: HomeArticle[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      const excerpt = item.contentSnippet || "Read the full coverage at the source.";
      stories.push({
        id: item.link || `${source.source.feedUrl}-${item.title}`,
        title: item.title || "Untitled article",
        excerpt,
        publishedAt: item.pubDate,
        readTime: estimateReadTime(excerpt),
        imageUrl:
          item.thumbnail || source.source.image || "/images/placeholders/article.svg",
        externalUrl: item.link || "/articles",
      });
    }
  }

  return stories.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function createFallbackVideos(): HomeVideo[] {
  return latestVideos.map((video, index) => ({
    id: `fallback-video-${index}`,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    channelName: video.channelName,
    publishedAt: video.publishedAt,
    duration: video.duration,
    videoUrl: "/videos",
  }));
}

function createFallbackArticles(): HomeArticle[] {
  return articles.map((article, index) => ({
    id: `fallback-article-${index}`,
    title: article.title,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    readTime: article.readTime,
    imageUrl: article.imageUrl,
    externalUrl: "/articles",
  }));
}

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(3, Math.ceil(words / 180));
  return `~${minutes} min read`;
}

function formatDate(rawDate: string): string {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}
