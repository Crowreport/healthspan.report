import Link from "next/link";
import styles from "./LifestyleNewsSection.module.css";

export interface LifestyleNewsItem {
  id: string;
  title: string;
  excerpt?: string;
  imageUrl: string;
  externalUrl: string;
  publishedAt: string;
  readTime: string;
}

interface LifestyleNewsSectionProps {
  items: LifestyleNewsItem[];
  viewAllHref?: string;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Just the date — no UTC time component. */
function formatDate(rawDate: string): string {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

export default function LifestyleNewsSection({
  items,
  viewAllHref = "/articles",
}: LifestyleNewsSectionProps) {
  const [hero, ...rest] = items;
  if (!hero) return null;
  const listItems = rest.slice(0, 6);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.badge}>Lifestyle</span>
          <h2 className={styles.title}>Lifestyle News</h2>
        </div>
        <Link href={viewAllHref} className={styles.viewAll}>
          View all Lifestyle
        </Link>
      </div>

      <div className={styles.layout}>
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
            loading="lazy"
            onError={handleImageError}
          />
          <div className={styles.heroBody}>
            <h3 className={styles.heroTitle}>{hero.title}</h3>
            {hero.excerpt && <p className={styles.heroExcerpt}>{hero.excerpt}</p>}
            <p className={styles.heroMeta}>
              {formatDate(hero.publishedAt)}
              {hero.readTime && <span className={styles.dot}>&middot;</span>}
              {hero.readTime}
            </p>
          </div>
        </a>

        {listItems.length > 0 && (
          <div className={styles.grid}>
            {listItems.map((item) => {
              const href = item.externalUrl;
              const isExternal = isExternalHref(href);

              return (
                <a
                  key={item.id}
                  href={href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className={styles.row}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className={styles.rowThumb}
                    loading="lazy"
                    onError={handleImageError}
                  />
                  <div className={styles.rowBody}>
                    <span className={styles.rowTitle}>{item.title}</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
