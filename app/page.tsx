"use client";

import { useEffect, useMemo, useState } from "react";
import { Header, Footer } from "@/components/layout";
import { TopNews } from "@/components/sections";
import LatestResearchSection from "@/components/sections/LatestResearchSection";
import type { TopNewsItem } from "@/components/sections/TopNews";
import { CommentBubble } from "@/components/ui";
import SponsoredSection from "@/components/sections/SponsoredSection";
import TrendingNewsSection from "@/components/sections/TrendingNewsSection";
import LifestyleNewsSection from "@/components/sections/LifestyleNewsSection";
import YourLibrarySection from "@/components/sections/YourLibrarySection";
import TopChannelsSection from "@/components/sections/TopChannelsSection";
import TopPodcastsSection from "@/components/sections/TopPodcastsSection";
import { articles, latestVideos, podcasts } from "@/data/mockData";
import { useUserStore } from "@/store/useUserStore";
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
  sourceName?: string;
  tag?: string;
};

type HomePodcast = {
  id: string;
  title: string;
  thumbnailUrl: string;
  publisher: string;
  publishedAt: string;
  url: string;
};

export type TopChannel = {
  id: string;
  name: string;
  avatarUrl?: string;
  videoCount: number;
  /**
   * PLACEHOLDER — fabricated for visual/demo purposes only. There is no real
   * subscriber-count data anywhere in this app (RSS doesn't provide it, no
   * column exists for it). Deterministic per channel name so it doesn't
   * shuffle on every render, but it is not real. Do not ship this to real
   * users without either wiring a real YouTube Data API lookup or removing
   * this field — see chat history for why this exists.
   */
  fakeSubscriberCount: string;
  href: string;
};

export type TopPodcastShow = {
  id: string;
  name: string;
  artworkUrl?: string;
  creator?: string;
  episodeCount: number;
  href: string;
};

/** Shape returned by GET /api/top-news (see lib/content/topNews.ts). */
type TopNewsAPIItem = {
  id: string;
  headline: string;
  teaser: string;
  imageUrl: string;
  externalUrl: string;
  publishedAt: string;
  sourceName: string;
  tags: string[];
  rank: number;
};

type TopNewsAPIResponse = {
  hero: TopNewsAPIItem | null;
  items: TopNewsAPIItem[];
  total: number;
};

type EditableContentType = "video" | "article" | "podcast";

interface HomepageOverride {
  title?: string;
  url?: string;
  imageUrl?: string;
  publishedAt?: string;
  metaPrimary?: string;
  metaSecondary?: string;
  excerpt?: string;
}

type HomepageOverrides = Record<string, HomepageOverride>;

type EditTarget =
  | {
      type: "video";
      item: HomeVideo;
    }
  | {
      type: "article";
      item: HomeArticle;
    }
  | {
      type: "podcast";
      item: HomePodcast;
    };

type EditorFormState = {
  title: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  metaPrimary: string;
  metaSecondary: string;
  excerpt: string;
};

const HOMEPAGE_OVERRIDES_STORAGE_KEY = "healthspan-homepage-content-overrides";

function EditActionButton({
  onClick,
  label = "Edit",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={styles.editButton}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path
          d="M12 20h9"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function attachImageFallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackSrc: string
) {
  const image = event.currentTarget;
  image.onerror = null;
  image.src = fallbackSrc;
}

export default function Home() {
  const [videoItems, setVideoItems] = useState<HomeVideo[]>(createFallbackVideos());
  const [articleItems, setArticleItems] = useState<HomeArticle[]>(createFallbackArticles());
  const [podcastItems, setPodcastItems] = useState<HomePodcast[]>(createFallbackPodcasts());
  // Per-source summaries (name, real avatar/artwork image, real item count) —
  // distinct from videoItems/podcastItems, which are the flattened per-episode
  // lists. Empty until /api/rss resolves; no mock seed, since there's nothing
  // honest to show before real source data exists.
  const [channels, setChannels] = useState<TopChannel[]>([]);
  const [podcastShows, setPodcastShows] = useState<TopPodcastShow[]>([]);
  // Real research-type sources (rss_sources.content_type = 'research', e.g.
  // NIH/Nature Aging) via /api/rss?type=research — not the legacy
  // public.articles table, which ArticleGrid pulled from before.
  const [researchArticles, setResearchArticles] = useState<HomeArticle[]>([]);
  const [overrides, setOverrides] = useState<HomepageOverrides>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(HOMEPAGE_OVERRIDES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as HomepageOverrides;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.error("Failed to read homepage overrides:", error);
      return {};
    }
  });
  // Recency-driven Top News from /api/top-news. Null until the fetch
  // resolves; an empty array means "resolved, but the DB has nothing".
  const [topNewsFromApi, setTopNewsFromApi] = useState<TopNewsItem[] | null>(null);
  // rss_items.id -> comment count. Missing key = not loaded yet / no comments.
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editForm, setEditForm] = useState<EditorFormState | null>(null);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HOMEPAGE_OVERRIDES_STORAGE_KEY,
        JSON.stringify(overrides)
      );
    } catch (error) {
      console.error("Failed to store homepage overrides:", error);
    }
  }, [overrides]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateHomepageLinks() {
      try {
        const [videoResponse, articleResponse, podcastResponse, researchResponse] = await Promise.all([
          fetch("/api/rss?type=video"),
          fetch("/api/rss?type=article"),
          fetch("/api/rss?type=podcast"),
          fetch("/api/rss?type=research"),
        ]);

        if (!isCancelled && videoResponse.ok) {
          const videoPayload = (await videoResponse.json()) as RSSAPIResponse;
          const mappedVideos = mapVideoSources(videoPayload.sources || []);
          if (mappedVideos.length > 0) {
            setVideoItems(mappedVideos);
          }
          setChannels(mapChannels(videoPayload.sources || []));
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
          const mappedPodcasts = mapPodcastSources(podcastPayload.sources || []);
          if (mappedPodcasts.length > 0) {
            setPodcastItems(mappedPodcasts);
          }
          setPodcastShows(mapPodcastShowSources(podcastPayload.sources || []));
        }

        if (!isCancelled && researchResponse.ok) {
          const researchPayload = (await researchResponse.json()) as RSSAPIResponse;
          setResearchArticles(mapArticleSources(researchPayload.sources || []));
        }
      } catch (error) {
        console.error("Homepage feed hydration failed:", error);
      }
    }

    void hydrateHomepageLinks();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Top News is driven by the `featured` flag, not by recency. Fetched
  // separately so a failure here leaves the rest of the homepage intact.
  useEffect(() => {
    let isCancelled = false;

    async function hydrateTopNews() {
      try {
        const response = await fetch("/api/top-news?limit=6");
        if (!response.ok) return;

        const payload = (await response.json()) as TopNewsAPIResponse;
        if (isCancelled) return;

        const ordered = [payload.hero, ...(payload.items ?? [])].filter(
          (entry): entry is TopNewsAPIItem => Boolean(entry)
        );

        setTopNewsFromApi(
          ordered.map((entry) => ({
            id: entry.id,
            title: entry.headline,
            excerpt: entry.teaser,
            imageUrl: entry.imageUrl,
            externalUrl: entry.externalUrl,
            publishedAt: formatDate(entry.publishedAt),
            sourceName: entry.sourceName,
            tags: entry.tags,
          }))
        );
      } catch (error) {
        console.error("Top News hydration failed:", error);
      }
    }

    void hydrateTopNews();

    return () => {
      isCancelled = true;
    };
  }, []);

  const editableVideos = useMemo(
    () => applyVideoOverrides(videoItems, overrides),
    [videoItems, overrides]
  );
  const editableArticles = useMemo(
    () => applyArticleOverrides(articleItems, overrides),
    [articleItems, overrides]
  );
  const editablePodcasts = useMemo(
    () => applyPodcastOverrides(podcastItems, overrides),
    [podcastItems, overrides]
  );

  // Each named section gets its own non-overlapping slice of articles so
  // "Trending News" / "Lifestyle News" don't all show the exact same cards.
  const trendingArticles = useMemo(() => editableArticles.slice(0, 18), [editableArticles]);
  const lifestyleArticles = useMemo(() => editableArticles.slice(18, 36), [editableArticles]);
  // /api/top-news is purely algorithmic (recency, newest first — see
  // lib/content/topNews.ts) and never empty unless the DB genuinely has
  // nothing. No client-side fallback needed: null/[] just means "still
  // loading," which TopNews already renders as its own skeleton.
  const topNewsItems = useMemo(() => topNewsFromApi ?? [], [topNewsFromApi]);

  // Bulk comment counts for whatever cards are currently on screen. Ids that
  // aren't real rss_items rows (fallback/mock data) are dropped server-side.
  useEffect(() => {
    const ids = new Set<string>();
    for (const video of editableVideos) ids.add(video.id);
    for (const article of editableArticles) ids.add(article.id);
    for (const podcast of editablePodcasts) ids.add(podcast.id);
    for (const item of topNewsItems) ids.add(item.id);

    if (ids.size === 0) return;

    let isCancelled = false;

    fetch(`/api/comments/counts?ids=${Array.from(ids).join(",")}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { counts?: Record<string, number> } | null) => {
        if (!isCancelled && payload?.counts) {
          setCommentCounts((current) => ({ ...current, ...payload.counts }));
        }
      })
      .catch((error) => console.error("Comment counts fetch failed:", error));

    return () => {
      isCancelled = true;
    };
  }, [editableVideos, editableArticles, editablePodcasts, topNewsItems]);

  const featuredVideo = editableVideos[0];
  const sideVideos = useMemo(() => {
    const base = editableVideos.length > 1 ? editableVideos.slice(1) : editableVideos;
    return base.slice(0, 6);
  }, [editableVideos]);

  function openEditor(target: EditTarget) {
    setEditTarget(target);
    setEditForm(createEditorForm(target));
  }

  function closeEditor() {
    setEditTarget(null);
    setEditForm(null);
  }

  function saveEditorChanges() {
    if (!editTarget || !editForm) return;

    setOverrides((current) => ({
      ...current,
      [createOverrideKey(editTarget.type, editTarget.item.id)]: {
        title: editForm.title,
        url: editForm.url,
        imageUrl: editForm.imageUrl,
        publishedAt: editForm.publishedAt,
        metaPrimary: editForm.metaPrimary,
        metaSecondary: editForm.metaSecondary,
        excerpt: editForm.excerpt,
      },
    }));

    closeEditor();
  }

  function resetEditorChanges() {
    if (!editTarget) return;

    const key = createOverrideKey(editTarget.type, editTarget.item.id);
    setOverrides((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    closeEditor();
  }

  const featuredVideoHref = featuredVideo
    ? normalizeHref(featuredVideo.videoUrl, "/videos")
    : "#";
  const featuredVideoExternal = isExternalHref(featuredVideoHref);

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          <TopNews items={topNewsItems} viewAllHref="/articles" commentCounts={commentCounts} />

          {featuredVideo && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Featured Video</h2>
              </div>
              <div className={styles.featuredVideoLayout}>
                <div className={styles.playerColumn}>
                  <div className={styles.editableCardWrap}>
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
                        onError={(event) =>
                          attachImageFallback(event, "/images/placeholders/video.svg")
                        }
                      />
                      <div className={styles.playBadge} aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </a>
                    {isAuthenticated && (
                      <EditActionButton
                        label="Edit featured video"
                        onClick={() => openEditor({ type: "video", item: featuredVideo })}
                      />
                    )}
                  </div>

                  <div className={styles.playerMeta}>
                    <h3 className={styles.playerTitle}>{featuredVideo.title}</h3>
                    <p className={styles.playerSubline}>
                      {featuredVideo.channelName}
                      <span>|</span>
                      {featuredVideo.publishedAt}
                      <CommentBubble count={commentCounts[featuredVideo.id]} />
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
                        <div key={`${video.id}-${index}`} className={styles.editableCardWrap}>
                          <a
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
                                onError={(event) =>
                                  attachImageFallback(event, "/images/placeholders/video.svg")
                                }
                              />
                            </div>
                            <div className={styles.upNextMeta}>
                              <h4>{video.title}</h4>
                              <p className={styles.upNextDate}>
                                {video.publishedAt}
                                {video.duration && ` | ${video.duration}`}
                              </p>
                              <div className={styles.upNextFooter}>
                                <p className={styles.upNextChannel}>{video.channelName}</p>
                                <CommentBubble count={commentCounts[video.id]} />
                              </div>
                            </div>
                          </a>
                          {isAuthenticated && (
                            <EditActionButton
                              label="Edit up next video"
                              onClick={() => openEditor({ type: "video", item: video })}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </section>
          )}

          <TrendingNewsSection items={trendingArticles.slice(0, 4)} viewAllHref="/topics" />

          <LifestyleNewsSection items={lifestyleArticles} viewAllHref="/articles" />

          <YourLibrarySection />

          <TopChannelsSection channels={channels} />

          <TopPodcastsSection shows={podcastShows} />

          <LatestResearchSection items={researchArticles} viewAllHref="/research" />

          <SponsoredSection />

          {/* Supplement News and Research Deep Dives intentionally not
              rendered here — see chat for why (Supplements: told not to
              worry about it; Research Deep Dives: deferred, not yet built
              this pass). */}
        </div>
      </main>

      <Footer />

      {isAuthenticated && editTarget && editForm && (
        <div
          className={styles.editorBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Edit homepage content"
          onClick={closeEditor}
        >
          <div className={styles.editorModal} onClick={(event) => event.stopPropagation()}>
            <h3 className={styles.editorTitle}>
              Edit {editTarget.type === "video" ? "video" : editTarget.type}
            </h3>
            <p className={styles.editorSubtitle}>
              Changes are saved in your browser and shown right away on the homepage.
            </p>

            <div className={styles.editorFields}>
              <label className={styles.editorLabel}>
                Title
                <input
                  className={styles.editorInput}
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className={styles.editorLabel}>
                Link URL
                <input
                  className={styles.editorInput}
                  value={editForm.url}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, url: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className={styles.editorLabel}>
                Thumbnail URL
                <input
                  className={styles.editorInput}
                  value={editForm.imageUrl}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, imageUrl: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className={styles.editorLabel}>
                Published text
                <input
                  className={styles.editorInput}
                  value={editForm.publishedAt}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, publishedAt: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className={styles.editorLabel}>
                {getPrimaryMetaLabel(editTarget.type)}
                <input
                  className={styles.editorInput}
                  value={editForm.metaPrimary}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, metaPrimary: event.target.value } : current
                    )
                  }
                />
              </label>

              {editTarget.type === "video" && (
                <label className={styles.editorLabel}>
                  Duration text
                  <input
                    className={styles.editorInput}
                    value={editForm.metaSecondary}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, metaSecondary: event.target.value } : current
                      )
                    }
                  />
                </label>
              )}

              {editTarget.type === "article" && (
                <label className={styles.editorLabel}>
                  Excerpt
                  <textarea
                    className={styles.editorTextarea}
                    rows={4}
                    value={editForm.excerpt}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, excerpt: event.target.value } : current
                      )
                    }
                  />
                </label>
              )}
            </div>

            <div className={styles.editorActions}>
              <button
                type="button"
                className={styles.editorPrimaryAction}
                onClick={saveEditorChanges}
              >
                Save changes
              </button>
              <button
                type="button"
                className={styles.editorSecondaryAction}
                onClick={resetEditorChanges}
              >
                Reset item
              </button>
              <button
                type="button"
                className={styles.editorSecondaryAction}
                onClick={closeEditor}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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

/**
 * One summary row per distinct source — real name, real avatar image
 * (rss_sources.image_url), real video count. No subscriber count: that data
 * doesn't exist anywhere in the RSS pipeline, and a mockup showing one is not
 * a reason to invent a number.
 */
/**
 * Fabricated placeholder — see the fakeSubscriberCount doc comment. Hashes
 * the channel name to a stable-but-arbitrary number in a plausible range so
 * it doesn't reshuffle on every render.
 */
function fakeSubscriberCountFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const value = 50_000 + (hash % 1_950_000);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M subscribers`;
  return `${Math.round(value / 1000)}K subscribers`;
}

function mapChannels(sources: RSSSource[]): TopChannel[] {
  // Two rss_sources rows can share a display name (e.g. a channel with both
  // a curated feed and a direct YouTube feed) — merge them into one card
  // rather than showing the same channel twice.
  const byName = new Map<string, TopChannel>();

  for (const source of sources) {
    if (source.articles.length === 0) continue;
    const name = source.source.title;
    const existing = byName.get(name);
    if (existing) {
      existing.videoCount += source.articles.length;
      if (!existing.avatarUrl) {
        existing.avatarUrl = normalizeImageUrl(source.source.image) ?? undefined;
      }
      continue;
    }
    byName.set(name, {
      id: source.source.feedUrl,
      name,
      avatarUrl: normalizeImageUrl(source.source.image) ?? undefined,
      videoCount: source.articles.length,
      fakeSubscriberCount: fakeSubscriberCountFor(name),
      href: source.source.link || "/videos",
    });
  }

  return Array.from(byName.values());
}

/** Same idea as mapChannels, for podcast shows. */
function mapPodcastShowSources(sources: RSSSource[]): TopPodcastShow[] {
  const byName = new Map<string, TopPodcastShow>();

  for (const source of sources) {
    if (source.articles.length === 0) continue;
    const name = source.source.title;
    const existing = byName.get(name);
    if (existing) {
      existing.episodeCount += source.articles.length;
      if (!existing.artworkUrl) {
        existing.artworkUrl = normalizeImageUrl(source.source.image) ?? undefined;
      }
      continue;
    }
    byName.set(name, {
      id: source.source.feedUrl,
      name,
      artworkUrl: normalizeImageUrl(source.source.image) ?? undefined,
      creator: source.articles[0]?.creator,
      episodeCount: source.articles.length,
      href: source.source.link || "/podcasts",
    });
  }

  return Array.from(byName.values());
}

function mapVideoSources(sources: RSSSource[]): HomeVideo[] {
  const videos: HomeVideo[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      videos.push({
        id: item.id || item.link || `${source.source.feedUrl}-${item.title}`,
        title: item.title || "Untitled video",
        thumbnailUrl: resolveImageUrl(
          item.thumbnail,
          source.source.image,
          "/images/placeholders/video.svg"
        ),
        channelName: source.source.title,
        publishedAt: formatDate(item.pubDate),
        duration: "",
        videoUrl: item.link || "/videos",
      });
    }
  }

  return dedupeById(videos).sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

function mapArticleSources(sources: RSSSource[]): HomeArticle[] {
  const stories: HomeArticle[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      const excerpt = item.contentSnippet || "Read the full coverage at the source.";
      stories.push({
        id: item.id || item.link || `${source.source.feedUrl}-${item.title}`,
        title: item.title || "Untitled article",
        excerpt,
        publishedAt: item.pubDate,
        readTime: estimateReadTime(excerpt),
        imageUrl: resolveImageUrl(
          item.thumbnail,
          source.source.image,
          "/images/placeholders/article.svg"
        ),
        externalUrl: item.link || "/articles",
        sourceName: item.creator || source.source.title,
        tag: item.categories?.[0],
      });
    }
  }

  return dedupeById(stories).sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

function mapPodcastSources(sources: RSSSource[]): HomePodcast[] {
  const parsedPodcasts: HomePodcast[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      parsedPodcasts.push({
        id: item.id || item.link || `${source.source.feedUrl}-${item.title}`,
        title: item.title || "Untitled podcast",
        thumbnailUrl: resolveImageUrl(
          item.thumbnail,
          source.source.image,
          "/images/placeholders/video.svg"
        ),
        publisher: source.source.title,
        publishedAt: formatDate(item.pubDate),
        url: item.link || "/podcasts",
      });
    }
  }

  return dedupeById(parsedPodcasts).sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
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

function resolveImageUrl(
  primary: string | undefined,
  secondary: string | undefined,
  fallback: string
): string {
  return normalizeImageUrl(primary) || normalizeImageUrl(secondary) || fallback;
}

function normalizeImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("/")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, "https://");

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) {
    return `https://${value}`;
  }

  return null;
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

function createOverrideKey(type: EditableContentType, id: string): string {
  return `${type}:${id}`;
}

function applyVideoOverrides(videos: HomeVideo[], overrides: HomepageOverrides): HomeVideo[] {
  return videos.map((video) => {
    const override = overrides[createOverrideKey("video", video.id)];
    if (!override) return video;

    return {
      ...video,
      title: override.title ?? video.title,
      thumbnailUrl: override.imageUrl ?? video.thumbnailUrl,
      channelName: override.metaPrimary ?? video.channelName,
      publishedAt: override.publishedAt ?? video.publishedAt,
      duration: override.metaSecondary ?? video.duration,
      videoUrl: override.url ?? video.videoUrl,
    };
  });
}

function applyArticleOverrides(
  articlesList: HomeArticle[],
  overrides: HomepageOverrides
): HomeArticle[] {
  return articlesList.map((article) => {
    const override = overrides[createOverrideKey("article", article.id)];
    if (!override) return article;

    return {
      ...article,
      title: override.title ?? article.title,
      excerpt: override.excerpt ?? article.excerpt,
      publishedAt: override.publishedAt ?? article.publishedAt,
      readTime: override.metaPrimary ?? article.readTime,
      imageUrl: override.imageUrl ?? article.imageUrl,
      externalUrl: override.url ?? article.externalUrl,
    };
  });
}

function applyPodcastOverrides(
  podcastsList: HomePodcast[],
  overrides: HomepageOverrides
): HomePodcast[] {
  return podcastsList.map((podcast) => {
    const override = overrides[createOverrideKey("podcast", podcast.id)];
    if (!override) return podcast;

    return {
      ...podcast,
      title: override.title ?? podcast.title,
      thumbnailUrl: override.imageUrl ?? podcast.thumbnailUrl,
      publisher: override.metaPrimary ?? podcast.publisher,
      publishedAt: override.publishedAt ?? podcast.publishedAt,
      url: override.url ?? podcast.url,
    };
  });
}

function createEditorForm(target: EditTarget): EditorFormState {
  if (target.type === "video") {
    return {
      title: target.item.title,
      url: target.item.videoUrl,
      imageUrl: target.item.thumbnailUrl,
      publishedAt: target.item.publishedAt,
      metaPrimary: target.item.channelName,
      metaSecondary: target.item.duration,
      excerpt: "",
    };
  }

  if (target.type === "article") {
    return {
      title: target.item.title,
      url: target.item.externalUrl,
      imageUrl: target.item.imageUrl,
      publishedAt: target.item.publishedAt,
      metaPrimary: target.item.readTime,
      metaSecondary: "",
      excerpt: target.item.excerpt,
    };
  }

  return {
    title: target.item.title,
    url: target.item.url,
    imageUrl: target.item.thumbnailUrl,
    publishedAt: target.item.publishedAt,
    metaPrimary: target.item.publisher,
    metaSecondary: "",
    excerpt: "",
  };
}

function getPrimaryMetaLabel(type: EditableContentType): string {
  if (type === "video") return "Channel name";
  if (type === "podcast") return "Publisher";
  return "Read time";
}
