/**
 * AI summary panel — POST /api/library/summarize (docs: app/api/library/summarize/route.ts).
 * Backend landed in #26 (lib/ai/summarize.ts).
 *
 * Distinguishes the backend's real error cases rather than a single generic
 * failure: 422 (nothing to summarize — permanent) reads differently from 429
 * (rate limited — retry later) or 502 (model failed — transient). Never
 * fabricates summary text on failure.
 */
"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/types/database";
import styles from "./AiSummaryPanel.module.css";

export interface SummaryTarget {
  itemId: string;
  title: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  tags: string[];
}

interface SummarizeError {
  error: string;
  code?: string;
  retryAfterSec?: number;
}

type State =
  | { status: "loading" }
  | { status: "ready"; summary: ItemSummary }
  | { status: "error"; message: string };

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

/** Maps the route's real status/code combinations to what a user should see. */
function messageFor(status: number, body: SummarizeError | null): string {
  if (status === 401) return "Log in to generate AI summaries.";
  if (status === 404) return "This item couldn't be found.";
  if (status === 422) return "There isn't enough content on this item to summarize.";
  if (status === 429) {
    const wait = body?.retryAfterSec ? ` Try again in ${body.retryAfterSec}s.` : "";
    return `You've hit the summary limit for now.${wait}`;
  }
  if (status === 502) return "The summarizer is temporarily unavailable — try again shortly.";
  return body?.error || "Couldn't generate a summary.";
}

export default function AiSummaryPanel({
  target,
  onClose,
}: {
  target: SummaryTarget;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/library/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: target.itemId }),
    })
      .then(async (response) => {
        if (isCancelled) return;
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as SummarizeError | null;
          setState({ status: "error", message: messageFor(response.status, body) });
          return;
        }
        const summary = (await response.json()) as ItemSummary;
        setState({ status: "ready", summary });
      })
      .catch(() => {
        if (!isCancelled) {
          setState({ status: "error", message: "Couldn't reach the summarizer — check your connection." });
        }
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

        {state.status === "loading" && <p className={styles.state}>Summarizing…</p>}

        {state.status === "error" && <p className={styles.state}>{state.message}</p>}

        {state.status === "ready" && (
          <>
            <ul className={styles.bullets}>
              {state.summary.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
            {state.summary.basis === "excerpt" && (
              <p className={styles.basisNote}>Based on a short excerpt, not the full article.</p>
            )}
            <p className={styles.disclaimer}>{state.summary.disclaimer}</p>
          </>
        )}
      </div>
    </section>
  );
}
