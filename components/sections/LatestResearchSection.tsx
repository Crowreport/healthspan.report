import Link from "next/link";
import styles from "./LatestResearchSection.module.css";

export interface LatestResearchItem {
  id: string;
  title: string;
  excerpt?: string;
  externalUrl: string;
  publishedAt: string;
  sourceName?: string;
}

interface LatestResearchSectionProps {
  items: LatestResearchItem[];
  viewAllHref?: string;
}

/** Cycles a source name through a few theme tokens for the eyebrow badge color. */
const SOURCE_TONES = ["primary", "accent", "warning", "success"] as const;
function toneFor(source: string): (typeof SOURCE_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) % SOURCE_TONES.length;
  return SOURCE_TONES[hash];
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

/**
 * Real research-type items — GET /api/rss?type=research
 * (rss_sources.content_type = 'research', e.g. NIH, Nature Aging), not the
 * legacy public.articles table this section used to pull from.
 */
export default function LatestResearchSection({
  items,
  viewAllHref = "/research",
}: LatestResearchSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Research Deep Dives</h2>
        <Link href={viewAllHref} className={styles.viewAll}>
          View all
        </Link>
      </div>

      <div className={styles.grid}>
        {items.slice(0, 3).map((item) => {
          const href = item.externalUrl || viewAllHref;
          const isExternal = isExternalHref(href);

          return (
            <a
              key={item.id}
              href={href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className={styles.card}
            >
              {item.sourceName && (
                <span className={`${styles.badge} ${styles[toneFor(item.sourceName)]}`}>
                  {item.sourceName}
                </span>
              )}
              <h3 className={styles.cardTitle}>{item.title}</h3>
              {item.excerpt && <p className={styles.excerpt}>{item.excerpt}</p>}
              <span className={styles.date}>{formatDate(item.publishedAt)}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
