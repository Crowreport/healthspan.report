"use client";

import { useState } from "react";
import Link from "next/link";
import EditArticleModal from "@/components/articles/EditArticleModal";
import type { TrendingTopic } from "@/types";
import styles from "./TrendingTopics.module.css";

export type TrendingTopicWithItemId = TrendingTopic & { itemId: string };

// Helper component for topic links (external or internal)
function TopicLink({
  topic,
  className,
  children,
  onEdit,
}: {
  topic: TrendingTopic;
  className: string;
  children: React.ReactNode;
  onEdit?: (e: React.MouseEvent) => void;
}) {
  const content = (
    <>
      {children}
      {onEdit && (
        <button
          type="button"
          className={styles.editButton}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(e); }}
          aria-label="Edit"
        >
          Edit
        </button>
      )}
    </>
  );
  if (topic.externalUrl) {
    return (
      <a
        href={topic.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={`/topics/${topic.slug}`} className={className}>
      {content}
    </Link>
  );
}

// Helper component for topic image with error handling
function TopicImage({
  imageUrl,
  title,
  size = "default",
}: {
  imageUrl: string;
  title?: string;
  size?: "default" | "large";
}) {
  const [imageError, setImageError] = useState(false);
  const hasImage =
    imageUrl && !imageUrl.includes("/images/placeholders/") && !imageError;
  const className = size === "large" ? styles.featuredImage : styles.topicImage;

  if (hasImage) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title || "Topic image"}
          className={styles.topicImageImg}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`${className} ${styles.imagePlaceholderBg}`}>
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

interface TrendingTopicsProps {
  /** Topics from DB (server-fetched). When provided, no client fetch. */
  initialTopics?: TrendingTopicWithItemId[];
  isAdmin?: boolean;
}

export default function TrendingTopics({ initialTopics = [], isAdmin = false }: TrendingTopicsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const topics = initialTopics;

  const featured = topics.find((t) => t.isFeatured);
  const regular = topics.filter((t) => !t.isFeatured);

  if (topics.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2 className={styles.title}>Trending Topics</h2>
          </div>
          <div className={styles.grid}>
            <div className={styles.skeleton}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonCategory} />
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonExcerpt} />
              </div>
            </div>
            <div className={styles.regularTopics}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonCardImage} />
                  <div className={styles.skeletonCardContent}>
                    <div className={styles.skeletonCategory} />
                    <div className={styles.skeletonTitle} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Trending Topics</h2>
        </div>

        <div className={styles.grid}>
          {/* Featured Topic */}
          {featured && (
            <TopicLink
              topic={featured}
              className={styles.featured}
              onEdit={isAdmin ? () => setEditingId(featured.itemId) : undefined}
            >
              <TopicImage imageUrl={featured.imageUrl} title={featured.title} size="large" />
              <div className={styles.featuredContent}>
                <span className={styles.category}>{featured.category}</span>
                <h3 className={styles.featuredTitle}>{featured.title}</h3>
                <p className={styles.featuredExcerpt}>{featured.excerpt}</p>
              </div>
            </TopicLink>
          )}

          {/* Regular Topics */}
          <div className={styles.regularTopics}>
            {regular.map((topic) => (
              <TopicLink
                key={topic.id}
                topic={topic}
                className={styles.topicCard}
                onEdit={isAdmin ? () => setEditingId(topic.itemId) : undefined}
              >
                <TopicImage imageUrl={topic.imageUrl} title={topic.title} />
                <div className={styles.topicContent}>
                  <span className={styles.topicCategory}>{topic.category}</span>
                  <h4 className={styles.topicTitle}>{topic.title}</h4>
                  <p className={styles.topicExcerpt}>{topic.excerpt}</p>
                </div>
              </TopicLink>
            ))}
          </div>
        </div>
      </div>
      <EditArticleModal
        articleId={editingId}
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
      />
    </section>
  );
}
