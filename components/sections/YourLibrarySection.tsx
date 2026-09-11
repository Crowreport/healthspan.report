"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/useUserStore";
import type { SavedItemWithItem } from "@/types/database";
import styles from "./YourLibrarySection.module.css";

interface SavedResponse {
  items: SavedItemWithItem[];
  total: number;
}

interface FoldersResponse {
  folders: { id: string; name: string; item_count: number }[];
  total: number;
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.9L12 3z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

/**
 * Homepage "Your Library" preview — signed-in users only. Real data from the
 * same endpoints /library itself uses (GET /api/library/saved, GET
 * /api/library/folders). Renders nothing for a logged-out visitor, and
 * nothing for a logged-in user with an empty library, rather than showing a
 * fake/empty preview.
 */
export default function YourLibrarySection() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [savedItems, setSavedItems] = useState<SavedItemWithItem[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [topFolder, setTopFolder] = useState<{ name: string; count: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isCancelled = false;

    Promise.all([
      fetch("/api/library/saved?limit=4").then((r) => (r.ok ? (r.json() as Promise<SavedResponse>) : null)),
      fetch("/api/library/folders").then((r) => (r.ok ? (r.json() as Promise<FoldersResponse>) : null)),
    ])
      .then(([saved, folders]) => {
        if (isCancelled) return;
        if (saved) {
          setSavedItems(saved.items);
          setTotalSaved(saved.total);
        }
        if (folders && folders.folders.length > 0) {
          const top = [...folders.folders].sort((a, b) => b.item_count - a.item_count)[0];
          setTopFolder({ name: top.name, count: top.item_count });
        }
        setLoaded(true);
      })
      .catch((error) => {
        console.error("Homepage library preview failed:", error);
        if (!isCancelled) setLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated || !loaded || savedItems.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.icon}>
          <BookmarkIcon />
        </span>
        <h2 className={styles.title}>Your Library</h2>
        <Link href="/library" className={styles.viewAll}>
          View all
        </Link>
      </div>

      <div className={styles.grid}>
        {savedItems.slice(0, 4).map((saved) =>
          saved.item ? (
            <a
              key={saved.id}
              href={saved.item.external_url}
              target={/^https?:\/\//i.test(saved.item.external_url) ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={styles.card}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={saved.item.thumbnail_url || "/images/placeholders/article.svg"}
                alt={saved.item.title}
                className={styles.cardImage}
                loading="lazy"
                onError={handleImageError}
              />
              <span className={styles.cardTitle}>{saved.item.title}</span>
            </a>
          ) : null
        )}

        {topFolder && (
          <Link href="/library" className={styles.utilityCard}>
            <span className={styles.utilityIcon}>
              <FolderIcon />
            </span>
            <span className={styles.utilityBody}>
              <span className={styles.utilityTitle}>{topFolder.name}</span>
              <span className={styles.utilitySub}>{topFolder.count} articles</span>
            </span>
          </Link>
        )}

        <Link href="/library" className={`${styles.utilityCard} ${styles.summaryCard}`}>
          <span className={styles.utilityIcon}>
            <SparkleIcon />
          </span>
          <span className={styles.utilityBody}>
            <span className={styles.utilityTitle}>AI Summary</span>
            <span className={styles.utilitySub}>Get key takeaways from your saved articles</span>
          </span>
        </Link>
      </div>

      <p className={styles.totalNote}>{totalSaved} saved articles</p>
    </section>
  );
}
