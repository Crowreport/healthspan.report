"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { articles, latestVideos, podcasts } from "@/data/mockData";
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

type HomePodcast = {
  id: string;
  title: string;
  thumbnailUrl: string;
  publisher: string;
  publishedAt: string;
  url: string;
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

function TopicSection({
  title,
  viewAllHref,
  articles,
}: {
  title: string;
  viewAllHref: string;
  articles: HomeArticle[];
}) {
  const columns = useMemo(
    () =>
      Array.from({ length: 3 }, (_, columnIndex) =>
        loopItems(articles, 6, columnIndex)
      ),
    [articles]
  );

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <Link href={viewAllHref} className={styles.viewAll}>
          View all
        </Link>
      </div>

      <div className={styles.trendingColumns}>
        {columns.map((column, columnIndex) => (
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
  );
}

interface MediaItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  groupName: string;
  url: string;
}

function GroupedMediaSection({
  title,
  items,
  viewAllHref,
  maxRows,
}: {
  title: string;
  items: MediaItem[];
  viewAllHref: string;
  maxRows?: number;
}) {
  const groups = useMemo(() => {
    const g: Record<string, MediaItem[]> = {};
    items.forEach((item) => {
      if (!g[item.groupName]) g[item.groupName] = [];
      g[item.groupName].push(item);
    });
    return g;
  }, [items]);

  const displayedGroups = maxRows ? Object.entries(groups).slice(0, maxRows) : Object.entries(groups);

  return (
    <section className={styles.videoSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2> 
      </div>
      <div className={styles.videoRows}>
        {displayedGroups.map(([groupName, groupItems], i) => (
          <div key={i} className={styles.channelGroup}>
            <h3 className={styles.channelTitle}>{groupName}</h3>
            <div className={styles.videoRow}>
              {groupItems.map((item, j) => {
                const href = normalizeHref(item.url, viewAllHref);
              const isExternal = isExternalHref(href);
              return (
                <a
                    key={`${item.id}-${i}-${j}`}
                  href={href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className={styles.videoCard}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                    className={styles.videoCardImage}
                    loading="lazy"
                  />
                    <div className={styles.videoCardContent}>
                      <h3 className={styles.videoCardTitle}>{item.title}</h3>
                      <p className={styles.videoCardDate}>{item.publishedAt}</p>
                  </div>
                </a>
              );
            })}
          </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [videoItems, setVideoItems] = useState<HomeVideo[]>(createFallbackVideos());
  const [articleItems, setArticleItems] = useState<HomeArticle[]>(createFallbackArticles());
  const [podcastItems, setPodcastItems] = useState<HomePodcast[]>(createFallbackPodcasts());

  useEffect(() => {
    let isCancelled = false;

    async function hydrateHomepageLinks() {
      try {
        const [videoResponse, articleResponse, podcastResponse] = await Promise.all([
          fetch("/api/rss?type=video"),
          fetch("/api/rss?type=article"),
          fetch("/api/rss?type=video"),
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

        if (!isCancelled && podcastResponse.ok) {
          const podcastPayload = (await podcastResponse.json()) as RSSAPIResponse;
          console.log("[Homepage] Raw Podcast Response:", podcastPayload);
          const mappedPodcasts = mapPodcastSources(podcastPayload.sources || []);
          if (mappedPodcasts.length > 0) {
            setPodcastItems(mappedPodcasts);
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

  const featuredVideo = videoItems[0];
  const sideVideos = useMemo(() => {
    const base = videoItems.length > 1 ? videoItems.slice(1) : videoItems;
    return loopItems(base, 6);
  }, [videoItems]);

  const mediaVideos = useMemo<MediaItem[]>(
    () =>
      videoItems.map((v) => ({
        id: v.id,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        groupName: v.channelName,
        url: v.videoUrl,
      })),
    [videoItems]
  );

  const mediaPodcasts = useMemo<MediaItem[]>(
    () =>
      podcastItems.map((p) => ({
        id: p.id,
        title: p.title,
        thumbnailUrl: p.thumbnailUrl,
        publishedAt: p.publishedAt,
        groupName: p.publisher,
        url: p.url,
      })),
    [podcastItems]
  );

  const featuredVideoHref = featuredVideo ? normalizeHref(featuredVideo.videoUrl, "/videos") : "#";
  const featuredVideoExternal = isExternalHref(featuredVideoHref);

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          {featuredVideo && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Featured Video</h2>
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
                <div className={styles.upNextGrid}>
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
                        </div>
                        <div className={styles.upNextMeta}>
                          <h4>{video.title}</h4>
                          <p className={styles.upNextDate}>
                            {video.publishedAt}
                            {video.duration && ` • ${video.duration}`}
                          </p>
                          <p className={styles.upNextChannel}>{video.channelName}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </aside>
            </div>
          </section>
          )}

          <div className={styles.adBanner}>Advertisement</div>

          <TopicSection
            title="Trending Topics"
            viewAllHref="/topics"
            articles={articleItems}
          />

          <div className={styles.adBanner}>Advertisement</div>

          <TopicSection
            title="Lifestyle News"
            viewAllHref="/articles"
            articles={articleItems}
          />

          <div className={styles.adBanner}>Advertisement</div>

          <GroupedMediaSection
            title="Top Youtube Channels"
            items={mediaVideos}
            viewAllHref="/videos"
          />

          <TopicSection
            title="Lifestyle News"
            viewAllHref="/articles"
            articles={articleItems}
          />

          <div className={styles.adBanner}>Advertisement</div>

          <GroupedMediaSection
            title="Top Podcasts"
            items={mediaPodcasts}
            viewAllHref="/podcasts"
            maxRows={3}
          />

          <div className={styles.adBanner}>Advertisement</div>

          <TopicSection
            title="Supplement News"
            viewAllHref="/articles"
            articles={articleItems}
          />
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

function mapPodcastSources(sources: RSSSource[]): HomePodcast[] {
  const podcasts: HomePodcast[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      podcasts.push({
        id: item.link || `${source.source.feedUrl}-${item.title}`,
        title: item.title || "Untitled podcast",
        thumbnailUrl:
          item.thumbnail || source.source.image || "/images/placeholders/video.svg",
        publisher: source.source.title,
        publishedAt: formatDate(item.pubDate),
        url: item.link || "/podcasts",
      });
    }
  }

  return podcasts.sort(
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

function createFallbackPodcasts(): HomePodcast[] {
  return podcasts.map((podcast, index) => ({
    id: `fallback-podcast-${index}`,
    title: podcast.name,
    thumbnailUrl: podcast.imageUrl,
    publisher: podcast.publisher,
    publishedAt: formatDate(podcast.publishedAt),
    url: podcast.podcastUrl || "/podcasts",
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
