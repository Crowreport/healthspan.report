"use client";

import { useState } from "react";
import Link from "next/link";
import { Article } from "@/types";
import styles from "./ArticleCard.module.css";

interface ArticleCardProps {
  article: Article;
  variant?: "default" | "compact";
}

function ImagePlaceholder() {
  return (
    <div className={styles.imagePlaceholder}>
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
    </div>
  );
}

export default function ArticleCard({
  article,
  variant = "default",
}: ArticleCardProps) {
  const [imageError, setImageError] = useState(false);

  const href = article.externalUrl || `/articles/${article.slug}`;
  const isExternal = !!article.externalUrl;
  const sourceName = article.sourceName || article.author || article.category;

  const titleNode = <h3 className={styles.title}>{article.title}</h3>;
  const TitleLink = isExternal ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.titleLink}
    >
      {titleNode}
    </a>
  ) : (
    <Link href={href} className={styles.titleLink}>
      {titleNode}
    </Link>
  );

  const hasImage = article.imageUrl && !imageError;

  return (
    <article className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.imageWrap}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.imageUrl}
            alt={article.title}
            className={styles.image}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder />
        )}
      </div>

      <div className={styles.content}>
        {TitleLink}
        <p className={styles.meta}>
          <span>{formatDate(article.publishedAt)}</span>
          <span className={styles.dot}>|</span>
          <span>{article.readTime}</span>
          <span className={styles.dot}>|</span>
          <span>{sourceName}</span>
        </p>
      </div>
    </article>
  );
}

function formatDate(rawDate: string): string {
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
