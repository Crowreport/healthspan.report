/**
 * "Recently viewed" strip — GET /api/library/history, per docs/library-history-api.md.
 *
 * That endpoint doesn't exist yet (no view-tracking table/instrumentation
 * anywhere in the app), so this deliberately renders nothing rather than mock
 * data: a per-user viewing history is a claim about the real user's own
 * behavior, and faking it would misrepresent what the app actually knows.
 * The section appears the moment a real response with items comes back.
 */
"use client";

import { useEffect, useState } from "react";
import styles from "./RecentlyViewedStrip.module.css";

export interface RecentlyViewedItem {
  id: string;
  title: string;
  source: string;
  imageUrl?: string;
  readTime: string;
  externalUrl: string;
}

interface HistoryEntry {
  item_id: string;
  viewed_at: string;
  item: {
    id: string;
    title: string;
    external_url: string;
    thumbnail_url: string | null;
    source?: { name: string } | null;
  } | null;
}

interface HistoryResponse {
  entries?: HistoryEntry[];
  items?: HistoryEntry[];
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

export default function RecentlyViewedStrip() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/library/history?limit=8")
      .then((response) => (response.ok ? (response.json() as Promise<HistoryResponse>) : null))
      .then((payload) => {
        if (isCancelled || !payload) return;
        const list = payload.entries ?? payload.items ?? [];
        const mapped = list
          .filter((entry) => entry.item !== null)
          .map((entry) => ({
            id: entry.item!.id,
            title: entry.item!.title,
            source: entry.item!.source?.name ?? "Unknown source",
            imageUrl: entry.item!.thumbnail_url ?? undefined,
            readTime: "",
            externalUrl: entry.item!.external_url,
          }));
        setItems(mapped);
      })
      .catch(() => {
        /* GET /api/library/history doesn't exist yet — leave the strip hidden */
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Recently viewed">
      <div className={styles.header}>
        <h2 className={styles.title}>Recently viewed</h2>
      </div>

      <div className={styles.strip}>
        {items.map((item) => (
          <a
            key={item.id}
            href={item.externalUrl}
            target={isExternalHref(item.externalUrl) ? "_blank" : undefined}
            rel={isExternalHref(item.externalUrl) ? "noopener noreferrer" : undefined}
            className={styles.card}
          >
            <div className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl || "/images/placeholders/article.svg"}
                alt={item.title}
                className={styles.thumbImage}
                loading="lazy"
                onError={handleImageError}
              />
              <span className={styles.viewedBadge} aria-label="Viewed" title="Viewed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </div>
            <span className={styles.cardTitle}>{item.title}</span>
            <span className={styles.cardSource}>{item.source}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
