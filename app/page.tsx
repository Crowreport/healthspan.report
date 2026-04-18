"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { ArticleGrid, TopChannels } from "@/components/sections";
import { AdPlaceholder } from "@/components/ui";
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
};

type HomePodcast = {
  id: string;
  title: string;
  thumbnailUrl: string;
  publisher: string;
  publishedAt: string;
  url: string;
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

function TopicSection({
  title,
  viewAllHref,
  articles,
  canEdit,
  onEditArticle,
}: {
  title: string;
  viewAllHref: string;
  articles: HomeArticle[];
  canEdit?: boolean;
  onEditArticle?: (article: HomeArticle) => void;
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
                <div
                  key={`${article.id}-${columnIndex}-${rowIndex}`}
                  className={styles.topicRowWrap}
                >
                  <a
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
                        onError={(event) =>
                          attachImageFallback(event, "/images/placeholders/article.svg")
                        }
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
                  {canEdit && onEditArticle && (
                    <EditActionButton
                      label="Edit article"
                      onClick={() => onEditArticle(article)}
                    />
                  )}
                </div>
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
  kind: "video" | "podcast";
}

function GroupedMediaSection({
  title,
  items,
  viewAllHref,
  maxRows,
  canEdit,
  onEditItem,
}: {
  title: string;
  items: MediaItem[];
  viewAllHref: string;
  maxRows?: number;
  canEdit?: boolean;
  onEditItem?: (item: MediaItem) => void;
}) {
  const groups = useMemo(() => {
    const groupedItems: Record<string, MediaItem[]> = {};
    items.forEach((item) => {
      if (!groupedItems[item.groupName]) groupedItems[item.groupName] = [];
      groupedItems[item.groupName].push(item);
    });
    return groupedItems;
  }, [items]);

  const displayedGroups = maxRows
    ? Object.entries(groups).slice(0, maxRows)
    : Object.entries(groups);

  return (
    <section className={styles.videoSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <div className={styles.videoRows}>
        {displayedGroups.map(([groupName, groupItems], index) => (
          <div key={index} className={styles.channelGroup}>
            <h3 className={styles.channelTitle}>{groupName}</h3>
            <div className={styles.videoRow}>
              {groupItems.map((item, itemIndex) => {
                const href = normalizeHref(item.url, viewAllHref);
                const isExternal = isExternalHref(href);

                return (
                  <div
                    key={`${item.id}-${index}-${itemIndex}`}
                    className={styles.editableCardWrap}
                  >
                    <a
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
                        onError={(event) =>
                          attachImageFallback(event, "/images/placeholders/video.svg")
                        }
                      />
                      <div className={styles.videoCardContent}>
                        <h3 className={styles.videoCardTitle}>{item.title}</h3>
                        <p className={styles.videoCardDate}>{item.publishedAt}</p>
                      </div>
                    </a>
                    {canEdit && onEditItem && (
                      <EditActionButton
                        label={item.kind === "video" ? "Edit video" : "Edit podcast"}
                        onClick={() => onEditItem(item)}
                      />
                    )}
                  </div>
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
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editForm, setEditForm] = useState<EditorFormState | null>(null);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const isAdmin = useUserStore((state) => state.profile?.role === "admin");

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
          const mappedPodcasts = mapPodcastSources(podcastPayload.sources || []);
          if (mappedPodcasts.length > 0) {
            setPodcastItems(mappedPodcasts);
          }
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

  const featuredVideo = editableVideos[0];
  const sideVideos = useMemo(() => {
    const base = editableVideos.length > 1 ? editableVideos.slice(1) : editableVideos;
    return loopItems(base, 6);
  }, [editableVideos]);

  const mediaVideos = useMemo<MediaItem[]>(
    () =>
      editableVideos.map((video) => ({
        id: video.id,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        groupName: video.channelName,
        url: video.videoUrl,
        kind: "video",
      })),
    [editableVideos]
  );

  const mediaPodcasts = useMemo<MediaItem[]>(
    () =>
      editablePodcasts.map((podcast) => ({
        id: podcast.id,
        title: podcast.title,
        thumbnailUrl: podcast.thumbnailUrl,
        publishedAt: podcast.publishedAt,
        groupName: podcast.publisher,
        url: podcast.url,
        kind: "podcast",
      })),
    [editablePodcasts]
  );

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
                              <p className={styles.upNextChannel}>{video.channelName}</p>
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

          <div className={styles.adBanner}>Advertisement</div>

          <TopicSection
            title="Trending Topics"
            viewAllHref="/topics"
            articles={editableArticles}
            canEdit={isAuthenticated}
            onEditArticle={(article) => openEditor({ type: "article", item: article })}
          />

          <div className={styles.adBanner}>Advertisement</div>

          <TopicSection
            title="Lifestyle News"
            viewAllHref="/articles"
            articles={editableArticles}
            canEdit={isAuthenticated}
            onEditArticle={(article) => openEditor({ type: "article", item: article })}
          />

        {/* Latest Articles (from DB) */}
        <ArticleGrid initialArticles={articles} isAdmin={!!isAdmin} />

          <GroupedMediaSection
            title="Top Youtube Channels"
            items={mediaVideos}
            viewAllHref="/videos"
            canEdit={isAuthenticated}
            onEditItem={(item) => {
              const matched = editableVideos.find((video) => video.id === item.id);
              if (matched) {
                openEditor({ type: "video", item: matched });
              }
            }}
          />

          <TopicSection
            title="Lifestyle News"
            viewAllHref="/articles"
            articles={editableArticles}
            canEdit={isAuthenticated}
            onEditArticle={(article) => openEditor({ type: "article", item: article })}
          />

        {/* Another Ad */}
        <section className={styles.adSection}>
          <div className={styles.adContainer}>
            <AdPlaceholder size="leaderboard" />
          </div>
        </section>

          <GroupedMediaSection
            title="Top Podcasts"
            items={mediaPodcasts}
            viewAllHref="/podcasts"
            maxRows={3}
            canEdit={isAuthenticated}
            onEditItem={(item) => {
              const matched = editablePodcasts.find((podcast) => podcast.id === item.id);
              if (matched) {
                openEditor({ type: "podcast", item: matched });
              }
            }}
          />

        {/* Top YouTube Channels */}
        <TopChannels />

          <TopicSection
            title="Supplement News"
            viewAllHref="/articles"
            articles={editableArticles}
            canEdit={isAuthenticated}
            onEditArticle={(article) => openEditor({ type: "article", item: article })}
          />
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

function loopItems<T>(items: T[], count: number, start = 0): T[] {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, index) => items[(start + index) % items.length]);
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

  return videos.sort(
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
        id: item.link || `${source.source.feedUrl}-${item.title}`,
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
      });
    }
  }

  return stories.sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

function mapPodcastSources(sources: RSSSource[]): HomePodcast[] {
  const parsedPodcasts: HomePodcast[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      parsedPodcasts.push({
        id: item.link || `${source.source.feedUrl}-${item.title}`,
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

  return parsedPodcasts.sort(
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
