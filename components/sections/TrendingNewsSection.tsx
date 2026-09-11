import Link from "next/link";
import styles from "./TrendingNewsSection.module.css";

export interface TrendingNewsItem {
  id: string;
  title: string;
  imageUrl: string;
  externalUrl: string;
  tag?: string;
}

interface TrendingNewsSectionProps {
  items: TrendingNewsItem[];
  viewAllHref?: string;
}

/** Cycles a tag string through a few theme tokens for the eyebrow badge color. */
const TAG_TONES = ["primary", "accent", "warning", "success"] as const;
function toneFor(tag: string): (typeof TAG_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) % TAG_TONES.length;
  return TAG_TONES[hash];
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

export default function TrendingNewsSection({
  items,
  viewAllHref = "/articles",
}: TrendingNewsSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Trending Now</h2>
        <Link href={viewAllHref} className={styles.viewAll}>
          View all
        </Link>
      </div>

      <div className={styles.grid}>
        {items.map((item) => {
          const href = item.externalUrl || "/articles";
          const isExternal = isExternalHref(href);

          return (
            <a
              key={item.id}
              href={href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className={styles.card}
            >
              <div className={styles.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className={styles.thumbImage}
                  loading="lazy"
                  onError={handleImageError}
                />
                {item.tag && (
                  <span className={`${styles.tag} ${styles[toneFor(item.tag)]}`}>
                    {item.tag}
                  </span>
                )}
              </div>
              <h3 className={styles.cardTitle}>{item.title}</h3>
            </a>
          );
        })}
      </div>
    </section>
  );
}
