"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trendingTopics as mockTopics } from "@/data/mockData";
import { slugify } from "@/lib/rss/rssFetcher";
import type { TrendingTopic } from "@/types";
import type { RSSAPIResponse, RSSSource } from "@/types/rss";
import styles from "./TrendingTopics.module.css";

function mapRSSToTopics(sources: RSSSource[]): TrendingTopic[] {
  const topics: TrendingTopic[] = [];
  let isFirst = true;

  for (const source of sources) {
    for (const item of source.articles) {
      topics.push({
        id: item.link,
        title: item.title,
        excerpt: item.contentSnippet || "",
        category: source.source.title,
        imageUrl: item.thumbnail || "/images/placeholder-topic.jpg",
        slug: slugify(item.title),
        isFeatured: isFirst,
        externalUrl: item.link, // Link to original article
      });
      isFirst = false;
    }
  }

  // Sort by date and limit
  return topics
    .sort(
      (a, b) =>
        new Date(b.id).getTime() - new Date(a.id).getTime()
    )
    .slice(0, 4);
}

// Helper component for topic links (external or internal)
function TopicLink({
  topic,
  className,
  children,
}: {
  topic: TrendingTopic;
  className: string;
  children: React.ReactNode;
}) {
  if (topic.externalUrl) {
    return (
      <a
        href={topic.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={`/topics/${topic.slug}`} className={className}>
      {children}
    </Link>
  );
}

// Helper component for topic image
function TopicImage({
  imageUrl,
  size = "default",
}: {
  imageUrl: string;
  size?: "default" | "large";
}) {
  const hasImage = imageUrl && !imageUrl.includes("placeholder");

  if (hasImage) {
    return (
      <div
        className={size === "large" ? styles.featuredImage : styles.topicImage}
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }

  return (
    <div className={size === "large" ? styles.featuredImage : styles.topicImage}>
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

export default function TrendingTopics() {
  const [topics, setTopics] = useState<TrendingTopic[]>(mockTopics);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTopics() {
      try {
        const response = await fetch("/api/rss?type=topic");
        if (!response.ok) throw new Error("Failed to fetch topics");

        const data: RSSAPIResponse = await response.json();
        const mappedTopics = mapRSSToTopics(data.sources);

        if (mappedTopics.length > 0) {
          // Mark first as featured
          mappedTopics[0].isFeatured = true;
          setTopics(mappedTopics);
        }
      } catch (err) {
        console.error("Failed to fetch RSS topics:", err);
        // Keep mock data on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopics();
  }, []);

  const featured = topics.find((t) => t.isFeatured);
  const regular = topics.filter((t) => !t.isFeatured);

  if (isLoading) {
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
            <TopicLink topic={featured} className={styles.featured}>
              <TopicImage imageUrl={featured.imageUrl} size="large" />
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
              >
                <TopicImage imageUrl={topic.imageUrl} />
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
    </section>
  );
}
