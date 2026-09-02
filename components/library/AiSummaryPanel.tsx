/**
 * AI summary panel — POST /api/library/summarize, per the Week 5 ticket.
 *
 * That endpoint doesn't exist yet, so this calls it for real (so it starts
 * working the moment a backend lands matching this contract) and shows an
 * honest "not available yet" state on failure — it never fabricates summary
 * text. Presenting invented bullet points as an "AI summary" of real health
 * content would be actively misleading, not just a placeholder.
 */
"use client";

import { useEffect, useState } from "react";
import styles from "./AiSummaryPanel.module.css";

export interface SummaryTarget {
  itemId: string;
  title: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  tags: string[];
}

interface SummarizeResponse {
  summary: { bullets: string[] };
}

type Status = "loading" | "ready" | "unavailable";

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.9L12 3z" />
    </svg>
  );
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

export default function AiSummaryPanel({
  target,
  onClose,
}: {
  target: SummaryTarget;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [bullets, setBullets] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/library/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: target.itemId }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`summarize failed: ${response.status}`);
        return response.json() as Promise<SummarizeResponse>;
      })
      .then((payload) => {
        if (isCancelled) return;
        setBullets(payload.summary.bullets);
        setStatus("ready");
      })
      .catch(() => {
        if (!isCancelled) setStatus("unavailable");
      });

    return () => {
      isCancelled = true;
    };
  }, [target.itemId]);

  return (
    <section className={styles.panel} aria-label="AI summary">
      <div className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={target.imageUrl || "/images/placeholders/article.svg"}
          alt=""
          className={styles.headerThumb}
          onError={handleImageError}
        />
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>{target.title}</span>
          <span className={styles.headerSub}>
            {target.source}
            {target.publishedAt && <span className={styles.dot}>&middot;</span>}
            {target.publishedAt}
          </span>
          {target.tags.length > 0 && (
            <div className={styles.tags}>
              {target.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close summary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.badge}>
          <SparkleIcon />
          AI Summary
        </div>

        {status === "loading" && <p className={styles.state}>Summarizing…</p>}

        {status === "unavailable" && (
          <p className={styles.state}>
            AI summaries aren&apos;t available yet — check back soon.
          </p>
        )}

        {status === "ready" && (
          <>
            <ul className={styles.bullets}>
              {bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
            <p className={styles.disclaimer}>
              Generated from your library — not medical advice.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
