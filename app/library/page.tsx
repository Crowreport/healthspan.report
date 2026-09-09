"use client";

import { useEffect, useMemo, useState } from "react";
import { Header, Footer } from "@/components/layout";
import FoldersSidebar from "@/components/library/FoldersSidebar";
import SavedArticleCard from "@/components/library/SavedArticleCard";
import SavedVideoCard from "@/components/library/SavedVideoCard";
import LibraryStatsCard from "@/components/library/LibraryStatsCard";
import CommunityQuestionCard from "@/components/library/CommunityQuestionCard";
import RecentlyViewedStrip from "@/components/library/RecentlyViewedStrip";
import AiSummaryPanel, { type SummaryTarget } from "@/components/library/AiSummaryPanel";
import type {
  LibraryFolder,
  LibrarySavedArticle,
  LibrarySavedVideo,
} from "@/lib/content/libraryTypes";
import type { SavedItemWithItem } from "@/types/database";
import styles from "./page.module.css";

type LibraryTab = "articles" | "videos";

/** GET /api/library/saved's response shape (docs/library-api.md). */
interface SavedResponse {
  items: SavedItemWithItem[];
  total: number;
}

/** GET/POST /api/library/folders's response shapes. */
interface FoldersResponse {
  folders: { id: string; name: string; item_count: number }[];
}
interface CreateFolderResponse {
  folder: { id: string; name: string };
}

function toArticle(saved: SavedItemWithItem): LibrarySavedArticle | null {
  const item = saved.item;
  if (!item) return null; // item was deleted out from under the saved row

  return {
    id: item.id,
    title: item.title,
    source: item.source?.name ?? "Unknown source",
    teaser: item.excerpt ?? "",
    tags: item.tag ? [item.tag] : [],
    imageUrl: item.thumbnail_url ?? undefined,
    readTime: "",
    publishedAt: item.published_at,
    externalUrl: item.external_url,
    folderId: saved.folder_id,
  };
}

function toVideo(saved: SavedItemWithItem): LibrarySavedVideo | null {
  const item = saved.item;
  if (!item) return null;

  return {
    id: item.id,
    title: item.title,
    channelName: item.youtube_channel_name ?? item.source?.name ?? "Unknown channel",
    duration: item.duration ?? "",
    tags: item.tag ? [item.tag] : [],
    thumbnailUrl: item.thumbnail_url ?? undefined,
    videoUrl: item.external_url,
    folderId: saved.folder_id,
  };
}

type LoadStatus = "loading" | "loaded" | "error";

export default function LibraryPage() {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [savedArticles, setSavedArticles] = useState<LibrarySavedArticle[]>([]);
  const [savedVideos, setSavedVideos] = useState<LibrarySavedVideo[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>("articles");
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [folderError, setFolderError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [summaryTarget, setSummaryTarget] = useState<SummaryTarget | null>(null);

  // Pull the caller's real saved items + folders.
  useEffect(() => {
    let isCancelled = false;

    const savedRequest = fetch("/api/library/saved?limit=100")
      .then((response) => {
        if (!response.ok) throw new Error(`GET /api/library/saved: ${response.status}`);
        return response.json() as Promise<SavedResponse>;
      })
      .then((payload) => {
        if (isCancelled) return;

        const articles: LibrarySavedArticle[] = [];
        const videos: LibrarySavedVideo[] = [];
        for (const saved of payload.items) {
          if (saved.item?.source?.content_type === "video") {
            const video = toVideo(saved);
            if (video) videos.push(video);
          } else {
            const article = toArticle(saved);
            if (article) articles.push(article);
          }
        }
        setSavedArticles(articles);
        setSavedVideos(videos);
      });

    const foldersRequest = fetch("/api/library/folders")
      .then((response) => {
        if (!response.ok) throw new Error(`GET /api/library/folders: ${response.status}`);
        return response.json() as Promise<FoldersResponse>;
      })
      .then((payload) => {
        if (isCancelled) return;
        setFolders(
          payload.folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            itemCount: folder.item_count,
          }))
        );
      });

    Promise.all([savedRequest, foldersRequest])
      .then(() => {
        if (!isCancelled) setLoadStatus("loaded");
      })
      .catch((error) => {
        console.error("Failed to load library:", error);
        if (!isCancelled) setLoadStatus("error");
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const ids = [...savedArticles.map((a) => a.id), ...savedVideos.map((v) => v.id)];
    if (ids.length === 0) return;

    let isCancelled = false;

    fetch(`/api/comments/counts?ids=${ids.join(",")}`)
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
  }, [savedArticles, savedVideos]);

  // Counted from the combined saved list (articles + videos) rather than
  // trusting each folder's server-side item_count, so this always matches
  // exactly what's rendered below.
  const countsByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of [...savedArticles, ...savedVideos]) {
      if (!item.folderId) continue;
      counts[item.folderId] = (counts[item.folderId] ?? 0) + 1;
    }
    return counts;
  }, [savedArticles, savedVideos]);

  const filteredArticles = useMemo(() => {
    if (activeFolderId === null) return savedArticles;
    return savedArticles.filter((article) => article.folderId === activeFolderId);
  }, [savedArticles, activeFolderId]);

  const filteredVideos = useMemo(() => {
    if (activeFolderId === null) return savedVideos;
    return savedVideos.filter((video) => video.folderId === activeFolderId);
  }, [savedVideos, activeFolderId]);

  async function handleCreateFolder(name: string) {
    setFolderError(null);
    const placeholderId = `pending-${Date.now()}`;
    setFolders((current) => [...current, { id: placeholderId, name }]);

    try {
      const response = await fetch("/api/library/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const payload = (await response.json()) as CreateFolderResponse;
        setFolders((current) =>
          current.map((folder) =>
            folder.id === placeholderId
              ? { id: payload.folder.id, name: payload.folder.name }
              : folder
          )
        );
        return;
      }

      // A real rejection (409 duplicate name, 400 bad name) — roll back.
      const payload = await response.json().catch(() => null);
      setFolders((current) => current.filter((folder) => folder.id !== placeholderId));
      setFolderError(payload?.error ?? "Failed to create folder.");
    } catch (error) {
      // Network error — roll back rather than leave a folder the server never saved.
      console.error("Create folder failed, rolling back:", error);
      setFolders((current) => current.filter((folder) => folder.id !== placeholderId));
      setFolderError("Failed to create folder — check your connection and try again.");
    }
  }

  async function handleUnsave(itemId: string) {
    const removedArticle = savedArticles.find((a) => a.id === itemId);
    const removedVideo = savedVideos.find((v) => v.id === itemId);
    setSavedArticles((current) => current.filter((a) => a.id !== itemId));
    setSavedVideos((current) => current.filter((v) => v.id !== itemId));

    try {
      const response = await fetch("/api/library/unsave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      // Unsave is idempotent server-side (200 with removed:false either way),
      // so any non-ok response here is a real failure, not "already gone".
      if (response.ok) return;
      throw new Error(`unsave failed: ${response.status}`);
    } catch (error) {
      console.error("Unsave failed, restoring card:", error);
      if (removedArticle) setSavedArticles((current) => [...current, removedArticle]);
      if (removedVideo) setSavedVideos((current) => [...current, removedVideo]);
    }
  }

  async function handleMoveToFolder(itemId: string, folderId: string | null) {
    const previousArticle = savedArticles.find((a) => a.id === itemId);
    const previousVideo = savedVideos.find((v) => v.id === itemId);
    setSavedArticles((current) =>
      current.map((a) => (a.id === itemId ? { ...a, folderId } : a))
    );
    setSavedVideos((current) =>
      current.map((v) => (v.id === itemId ? { ...v, folderId } : v))
    );

    try {
      const response = await fetch("/api/library/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, folder_id: folderId }),
      });
      // A 404 here is real: "that folder isn't yours" or "item not found" —
      // not a missing-endpoint signal, so it reverts like any other failure.
      if (response.ok) return;
      throw new Error(`move failed: ${response.status}`);
    } catch (error) {
      console.error("Move to folder failed, reverting:", error);
      if (previousArticle) {
        setSavedArticles((current) =>
          current.map((a) => (a.id === itemId ? previousArticle : a))
        );
      }
      if (previousVideo) {
        setSavedVideos((current) =>
          current.map((v) => (v.id === itemId ? previousVideo : v))
        );
      }
    }
  }

  function handleSummarize(itemId: string) {
    const article = savedArticles.find((a) => a.id === itemId);
    if (article) {
      setSummaryTarget({
        itemId: article.id,
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
        imageUrl: article.imageUrl,
        tags: article.tags,
      });
      return;
    }

    const video = savedVideos.find((v) => v.id === itemId);
    if (video) {
      setSummaryTarget({
        itemId: video.id,
        title: video.title,
        source: video.channelName,
        publishedAt: "",
        imageUrl: video.thumbnailUrl,
        tags: video.tags,
      });
    }
  }

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Your Library</h1>
          <p className={styles.pageSubtitle}>
            Save studies, build folders, and get AI summaries of the content you care about.
          </p>
        </div>

        <div className={styles.layout}>
          <FoldersSidebar
            folders={folders}
            activeFolderId={activeFolderId}
            countsByFolder={countsByFolder}
            totalCount={savedArticles.length + savedVideos.length}
            onSelectFolder={setActiveFolderId}
            onCreateFolder={handleCreateFolder}
          />

          <div className={styles.mainColumn}>
            {folderError && <p className={styles.folderError}>{folderError}</p>}

            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "articles" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("articles")}
              >
                Saved Articles
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "videos" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("videos")}
              >
                Saved Videos
              </button>
            </div>

            {loadStatus === "loading" ? (
              <p className={styles.empty}>Loading your library…</p>
            ) : loadStatus === "error" ? (
              <p className={styles.empty}>
                Couldn&apos;t load your library. Check your connection and refresh the page.
              </p>
            ) : activeTab === "articles" ? (
              filteredArticles.length === 0 ? (
                <p className={styles.empty}>No saved articles in this folder yet.</p>
              ) : (
                <div className={styles.articleGrid}>
                  {filteredArticles.map((article) => (
                    <SavedArticleCard
                      key={article.id}
                      article={article}
                      folders={folders}
                      commentCount={commentCounts[article.id]}
                      onUnsave={handleUnsave}
                      onMoveToFolder={handleMoveToFolder}
                      onSummarize={handleSummarize}
                    />
                  ))}
                </div>
              )
            ) : filteredVideos.length === 0 ? (
              <p className={styles.empty}>No saved videos in this folder yet.</p>
            ) : (
              <div className={styles.videoGrid}>
                {filteredVideos.map((video) => (
                  <SavedVideoCard
                    key={video.id}
                    video={video}
                    folders={folders}
                    commentCount={commentCounts[video.id]}
                    onUnsave={handleUnsave}
                    onMoveToFolder={handleMoveToFolder}
                    onSummarize={handleSummarize}
                  />
                ))}
              </div>
            )}

            {summaryTarget && (
              <AiSummaryPanel
                key={summaryTarget.itemId}
                target={summaryTarget}
                onClose={() => setSummaryTarget(null)}
              />
            )}
          </div>

          <aside className={styles.rightColumn}>
            <LibraryStatsCard
              folders={folders}
              countsByFolder={countsByFolder}
              totalCount={savedArticles.length + savedVideos.length}
            />
            <CommunityQuestionCard />
          </aside>
        </div>

        <RecentlyViewedStrip />
      </main>

      <Footer />
    </div>
  );
}
