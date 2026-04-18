import { Header, Footer } from "@/components/layout";
import CommentsSection from "@/components/comments/CommentsSection";
import BackLink from "@/components/navigation/BackLink";
import { getRSSItemBySlugAndType } from "@/lib/actions/rss";
import styles from "./page.module.css";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function truncateWithEllipsis(text: string, maxChars: number): string {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, Math.max(0, maxChars)).trimEnd();
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 40 ? slice.slice(0, lastSpace).trimEnd() : slice;
  return `${cut}...`;
}

export default async function VideoDiscussionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getRSSItemBySlugAndType("video", slug);

  if (result.error || !result.data) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.error}>
              <p>{result.error ?? "Video not found."}</p>
              <p>
                <BackLink fallbackHref="/videos">Back</BackLink>
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const item = result.data;
  const sourceName = item.source?.name ?? "Video";

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>{item.title}</h1>
          <div className={styles.meta}>
            <span>{sourceName}</span>
            {item.author && <span>By {item.author}</span>}
            <span>{formatDate(item.published_at)}</span>
          </div>

          {item.excerpt && (
            <p className={styles.excerpt}>{truncateWithEllipsis(item.excerpt, 180)}</p>
          )}

          <div className={styles.linkRow}>
            <a
              className={styles.externalLink}
              href={item.external_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch original →
            </a>
            <BackLink fallbackHref="/videos">Back</BackLink>
          </div>

          <CommentsSection rssItemId={item.id} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
