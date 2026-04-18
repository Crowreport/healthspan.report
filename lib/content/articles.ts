/**
 * Modular content layer: articles from DB (rss_items with content_type=article).
 * Used by Articles page and Home ArticleGrid. Extensible to other media types later.
 */

import { getRSSItemsByType } from "@/lib/actions/rss";
import type { DBRSSItemWithSource } from "@/types/database";
import type { Article } from "@/types";

const DEFAULT_READ_TIME = "5 min read";

/** Source-specific image placeholders when thumbnail is missing */
function getSourcePlaceholder(sourceUrl: string, sourceName: string): string {
  const url = (sourceUrl || "").toLowerCase();
  const name = (sourceName || "").toLowerCase();
  if (url.includes("peterattiamd.com") || name.includes("peter attia")) {
    return "/images/placeholders/attia.png";
  }
  if (url.includes("longevity.technology") || name.includes("longevity.technology")) {
    return "/images/placeholders/longevity.png";
  }
  return "/images/placeholders/NOVOSLabs.png";
}

/**
 * Map a DB RSS item (with source) to the shared Article type for UI.
 * Used for articles only; video/topic can have their own mappers later.
 */
export function mapRSSItemToArticle(item: DBRSSItemWithSource): Article {
  const source = item.source;
  const sourcePlaceholder = getSourcePlaceholder(
    source?.website_url || source?.feed_url || "",
    source?.name || ""
  );
  const imageUrl = item.thumbnail_url || sourcePlaceholder;

  return {
    id: item.id,
    title: item.title,
    excerpt: item.excerpt || "",
    category: source?.name || "Article",
    author: item.author || source?.name || "",
    publishedAt: item.published_at,
    readTime: DEFAULT_READ_TIME,
    imageUrl,
    slug: item.slug,
    externalUrl: item.external_url,
  };
}

/**
 * Get articles from the database only (rss_items where source content_type = article).
 * No direct RSS fetch; used by Articles page and Home.
 */
export async function getArticlesFromDB(limit?: number): Promise<{
  articles: Article[];
  error?: string;
}> {
  const result = await getRSSItemsByType("article", limit ?? 100);
  if (result.error) {
    return { articles: [], error: result.error };
  }
  const items = result.data ?? [];
  const articles = items.map(mapRSSItemToArticle);
  return { articles };
}
