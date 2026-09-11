/**
 * "Recently viewed" strip — GET /api/library/history (docs: app/api/library/history/route.ts).
 * Backend landed in #26 (migration 019 + lib/actions/readingHistory.ts).
 *
 * Renders nothing until a real response with entries comes back — no mock
 * fallback. A reading history is a claim about this specific user's real
 * behavior; faking it would misrepresent what the app actually knows, not
 * just stand in for missing data.
 */
"use client";

import { useEffect, useState } from "react";
import type { DBReadingHistoryEntryWithItem } from "@/types/database";
import styles from "./RecentlyViewedStrip.module.css";

interface HistoryResponse {
  entries: DBReadingHistoryEntryWithItem[];
  total: number;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

function formatViewedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

export default function RecentlyViewedStrip() {
  const [entries, setEntries] = useState<DBReadingHistoryEntryWithItem[]>([]);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/library/history?limit=8")
      .then((response) => (response.ok ? (response.json() as Promise<HistoryResponse>) : null))
      .then((payload) => {
        if (!isCancelled && payload) {
          setEntries(payload.entries.filter((entry) => entry.item !== null));
        }
      })
      .catch((error) => console.error("Reading history fetch failed:", error));

    return () => {
      isCancelled = true;
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Recently viewed">
      <div className={styles.header}>
        <h2 className={styles.title}>Recently viewed</h2>
      </div>

      <div className={styles.strip}>
        {entries.map((entry) => {
          const item = entry.item!;
          return (
            <a
              key={entry.id}
              href={item.external_url}
              target={isExternalHref(item.external_url) ? "_blank" : undefined}
              rel={isExternalHref(item.external_url) ? "noopener noreferrer" : undefined}
              className={styles.card}
            >
              <div className={styles.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnail_url || "/images/placeholders/article.svg"}
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
              <span className={styles.cardMeta}>
                {item.source?.name ?? "Unknown source"}
                <span className={styles.dot}>&middot;</span>
                {formatViewedAt(entry.viewed_at)}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
