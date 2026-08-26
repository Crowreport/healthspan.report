"use client";

import { useEffect, useMemo, useState } from "react";
import { Header, Footer } from "@/components/layout";
import FoldersSidebar from "@/components/library/FoldersSidebar";
import SavedArticleCard from "@/components/library/SavedArticleCard";
import SavedVideoCard from "@/components/library/SavedVideoCard";
import LibraryStatsCard from "@/components/library/LibraryStatsCard";
import CommunityQuestionCard from "@/components/library/CommunityQuestionCard";
import {
  mockFolders,
  mockSavedArticles,
  mockSavedVideos,
  type LibraryFolder,
  type LibrarySavedArticle,
  type LibrarySavedVideo,
} from "@/lib/content/libraryMock";
import styles from "./page.module.css";

type LibraryTab = "articles" | "videos";

export default function LibraryPage() {
  const [folders, setFolders] = useState<LibraryFolder[]>(mockFolders);
  const [savedArticles, setSavedArticles] = useState<LibrarySavedArticle[]>(mockSavedArticles);
  const [savedVideos] = useState<LibrarySavedVideo[]>(mockSavedVideos);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>("articles");
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // GET /api/library/saved + /api/library/folders don't exist yet (saved_items
  // is still a Week 4 design proposal — see docs/saved-items-model-proposal.md).
  // Try them anyway so the page picks up real data the moment they land;
  // silently keep the mock data otherwise.
  useEffect(() => {
    let isCancelled = false;

    fetch("/api/library/saved")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { articles?: LibrarySavedArticle[] } | null) => {
        if (!isCancelled && payload?.articles) {
          setSavedArticles(payload.articles);
        }
      })
      .catch(() => {
        /* endpoint not built yet — keep mock data */
      });

    fetch("/api/library/folders")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { folders?: LibraryFolder[] } | null) => {
        if (!isCancelled && payload?.folders) {
          setFolders(payload.folders);
        }
      })
      .catch(() => {
        /* endpoint not built yet — keep mock data */
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const ids = savedArticles.map((article) => article.id);
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
  }, [savedArticles]);

  const countsByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const article of savedArticles) {
      if (!article.folderId) continue;
      counts[article.folderId] = (counts[article.folderId] ?? 0) + 1;
    }
    return counts;
  }, [savedArticles]);

  const filteredArticles = useMemo(() => {
    if (activeFolderId === null) return savedArticles;
    return savedArticles.filter((article) => article.folderId === activeFolderId);
  }, [savedArticles, activeFolderId]);

  const filteredVideos = useMemo(() => {
    if (activeFolderId === null) return savedVideos;
    return savedVideos.filter((video) => video.folderId === activeFolderId);
  }, [savedVideos, activeFolderId]);

  function handleCreateFolder(name: string) {
    const folder: LibraryFolder = { id: `local-${Date.now()}`, name };
    setFolders((current) => [...current, folder]);

    fetch("/api/library/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {
      /* endpoint not built yet — folder stays local-only for now */
    });
  }

  function handleUnsave(id: string) {
    setSavedArticles((current) => current.filter((article) => article.id !== id));

    fetch(`/api/library/saved/${id}`, { method: "DELETE" }).catch(() => {
      /* endpoint not built yet — removal stays local-only for now */
    });
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
            totalCount={savedArticles.length}
            onSelectFolder={setActiveFolderId}
            onCreateFolder={handleCreateFolder}
          />

          <div className={styles.mainColumn}>
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

            {activeTab === "articles" ? (
              filteredArticles.length === 0 ? (
                <p className={styles.empty}>No saved articles in this folder yet.</p>
              ) : (
                <div className={styles.articleGrid}>
                  {filteredArticles.map((article) => (
                    <SavedArticleCard
                      key={article.id}
                      article={article}
                      commentCount={commentCounts[article.id]}
                      onUnsave={handleUnsave}
                    />
                  ))}
                </div>
              )
            ) : filteredVideos.length === 0 ? (
              <p className={styles.empty}>No saved videos in this folder yet.</p>
            ) : (
              <div className={styles.videoGrid}>
                {filteredVideos.map((video) => (
                  <SavedVideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </div>

          <aside className={styles.rightColumn}>
            <LibraryStatsCard
              folders={folders}
              countsByFolder={countsByFolder}
              totalCount={savedArticles.length}
            />
            <CommunityQuestionCard />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
