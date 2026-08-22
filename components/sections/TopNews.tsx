"use client";

import Link from "next/link";
import { CommentBubble, ReactionBar } from "@/components/ui";
import styles from "./TopNews.module.css";

export interface TopNewsItem {
  id: string;
  title: string;
  excerpt?: string;
  imageUrl: string;
  externalUrl: string;
  publishedAt: string;
  sourceName?: string;
}

interface TopNewsProps {
  /** Most-recent-first list of items. First item renders as the hero. */
  items: TopNewsItem[];
  viewAllHref?: string;
  /** rss_items.id -> comment count. Missing key renders as 0. */
  commentCounts?: Record<string, number>;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

export default function TopNews({
  items,
  viewAllHref = "/articles",
  commentCounts = {},
}: TopNewsProps) {
  const [hero, ...rest] = items;
  const rankedItems = rest.slice(0, 6);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Top News</h2>
            <span className={styles.headerBadge}>Top 10 this week</span>
          </div>
          <Link href={viewAllHref} className={styles.viewAll}>
            View all
          </Link>
        </div>

        {!hero ? (
          <>
            <div className={styles.skeletonHero} />
            <div className={styles.skeletonList}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skeletonRow} />
              ))}
            </div>
          </>
        ) : (
          <>
            <a
              href={hero.externalUrl}
              target={isExternalHref(hero.externalUrl) ? "_blank" : undefined}
              rel={isExternalHref(hero.externalUrl) ? "noopener noreferrer" : undefined}
              className={styles.hero}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.imageUrl}
                alt={hero.title}
                className={styles.heroImage}
                loading="eager"
                onError={handleImageError}
              />
              <div className={styles.heroContent}>
                <span className={styles.heroRank}>#1</span>
                <h3 className={styles.heroTitle}>{hero.title}</h3>
                {hero.excerpt && <p className={styles.heroExcerpt}>{hero.excerpt}</p>}
                <p className={styles.heroMeta}>
                  {hero.sourceName && <span>{hero.sourceName}</span>}
                  {hero.sourceName && <span className={styles.dot}>&middot;</span>}
                  <span>{hero.publishedAt}</span>
                  <span className={styles.heroEngagement}>
                    <ReactionBar itemId={hero.id} />
                    <CommentBubble count={commentCounts[hero.id]} />
                  </span>
                </p>
              </div>
            </a>

            {rankedItems.length > 0 && (
              <ol className={styles.list}>
                {rankedItems.map((item, index) => (
                  <li key={item.id} className={styles.listRow}>
                    <a
                      href={item.externalUrl}
                      target={isExternalHref(item.externalUrl) ? "_blank" : undefined}
                      rel={isExternalHref(item.externalUrl) ? "noopener noreferrer" : undefined}
                      className={styles.listLink}
                    >
                      <span className={styles.rank}>{index + 2}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className={styles.listThumb}
                        loading="lazy"
                        onError={handleImageError}
                      />
                      <span className={styles.listContent}>
                        <span className={styles.listTitle}>{item.title}</span>
                        <span className={styles.listMeta}>
                          {item.sourceName && <span>{item.sourceName}</span>}
                          {item.sourceName && <span className={styles.dot}>&middot;</span>}
                          <span>{item.publishedAt}</span>
                        </span>
                      </span>
                      <span className={styles.listEngagement}>
                        <ReactionBar itemId={item.id} />
                        <CommentBubble count={commentCounts[item.id]} />
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  );
}
