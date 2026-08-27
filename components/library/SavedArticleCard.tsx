"use client";

import { CommentBubble, ReactionBar } from "@/components/ui";
import type { LibrarySavedArticle } from "@/lib/content/libraryMock";
import styles from "./SavedArticleCard.module.css";

interface SavedArticleCardProps {
  article: LibrarySavedArticle;
  commentCount?: number;
  onUnsave: (id: string) => void;
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.9L12 3z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

export default function SavedArticleCard({ article, commentCount, onUnsave }: SavedArticleCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.imageUrl || "/images/placeholders/article.svg"}
          alt={article.title}
          className={styles.thumbImage}
          loading="lazy"
          onError={handleImageError}
        />
        <button
          type="button"
          className={styles.bookmarkButton}
          onClick={() => onUnsave(article.id)}
          aria-pressed="true"
          aria-label="Remove from saved articles"
          title="Remove from saved articles"
        >
          <BookmarkIcon />
        </button>
      </div>

      <div className={styles.body}>
        <a
          href={article.externalUrl}
          target={isExternalHref(article.externalUrl) ? "_blank" : undefined}
          rel={isExternalHref(article.externalUrl) ? "noopener noreferrer" : undefined}
          className={styles.link}
        >
          <h3 className={styles.title}>{article.title}</h3>
        </a>
        <span className={styles.source}>{article.source}</span>
        <p className={styles.teaser}>{article.teaser}</p>

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <ClockIcon />
            {article.readTime}
          </span>
          <span className={styles.metaItem}>
            <CalendarIcon />
            {article.publishedAt}
          </span>
        </div>

        {article.tags.length > 0 && (
          <div className={styles.tags}>
            {article.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.engagement}>
            <ReactionBar itemId={article.id} />
            <CommentBubble count={commentCount} />
          </div>

          <button
            type="button"
            className={styles.summarizeButton}
            disabled
            title="AI summaries are coming in Week 5"
          >
            <SparkleIcon />
            Summarize
          </button>
        </div>
      </div>
    </article>
  );
}
