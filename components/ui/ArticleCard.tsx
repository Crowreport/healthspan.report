"use client";

import { useState } from "react";
import Link from "next/link";
import { Article } from "@/types";
import styles from "./ArticleCard.module.css";

interface ArticleCardProps {
  article: Article;
  variant?: "default" | "compact";
  /** When set, shows an Edit button (for admins). */
  onEdit?: () => void;
}

// Placeholder component for failed/missing images
function ImagePlaceholder() {
  return (
    <div
      className={styles.image}
      style={{
        background: `linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary-muted) 100%)`,
      }}
    >
      <span className={styles.imagePlaceholder}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </span>
    </div>
  );
}

export default function ArticleCard({
  article,
  variant = "default",
  onEdit,
}: ArticleCardProps) {
  const fallbackImageUrl = getArticleFallbackImage(article);
  const primaryImageUrl = normalizeImageUrl(article.imageUrl);
  const [usingFallback, setUsingFallback] = useState(!primaryImageUrl);
  const [imageError, setImageError] = useState(false);
  const imageSrc = usingFallback ? fallbackImageUrl : primaryImageUrl || fallbackImageUrl;

  // Use external URL if available, otherwise internal route
  const href = article.externalUrl || `/articles/${article.slug}`;
  const isExternal = !!article.externalUrl;
  const discussionHref = `/articles/${article.slug}/discussion`;

  const TitleLink = isExternal ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.titleLink}
    >
      <h3 className={styles.title}>{article.title}</h3>
    </a>
  ) : (
    <Link href={href} className={styles.titleLink}>
      <h3 className={styles.title}>{article.title}</h3>
    </Link>
  );

  const hasImage = !!imageSrc && !imageError;

  return (
    <article className={`${styles.card} ${styles[variant]}`}>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
          className={styles.editButton}
          aria-label="Edit article"
        >
          Edit
        </button>
      )}
      <Link
        href={discussionHref}
        className={styles.commentLink}
        onClick={(e) => e.stopPropagation()}
        aria-label="Open comments"
        title="Comments"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
      </Link>
      <div className={styles.imageWrapper}>
        {hasImage ? (
          <div className={styles.imageContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={article.title}
              className={styles.image}
              onError={() => {
                if (!usingFallback) {
                  setUsingFallback(true);
                  return;
                }
                setImageError(true);
              }}
              loading="lazy"
            />
          </div>
        ) : (
          <ImagePlaceholder />
        )}
        <span className={styles.category}>{article.category}</span>
      </div>

      <div className={styles.content}>
        {TitleLink}

        {variant === "default" && (
          <p className={styles.excerpt}>{article.excerpt}</p>
        )}

        <div className={styles.meta}>
          <span className={styles.author}>{article.author}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.readTime}>{article.readTime}</span>
        </div>
      </div>
    </article>
  );
}

function getArticleFallbackImage(article: Article): string {
  const sourceText = `${article.sourceName || ""} ${article.author || ""} ${article.category || ""}`
    .toLowerCase()
    .trim();

  if (sourceText.includes("peter attia")) {
    return "/images/placeholders/attia.png";
  }
  if (sourceText.includes("longevity.technology") || sourceText.includes("longevity")) {
    return "/images/placeholders/longevity.png";
  }
  if (sourceText.includes("novos")) {
    return "/images/placeholders/NOVOSLabs.png";
  }

  return "/images/placeholders/article.svg";
}

function normalizeImageUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  const value = rawUrl.trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, "https://");
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;

  return null;
}
