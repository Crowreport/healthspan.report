/**
 * Top News selection.
 *
 * The Top News block is driven by the `is_featured` flag on rss_items: an admin
 * marks an item featured (via the Create Item tool or by editing an existing
 * item) and it becomes eligible. Ordering is:
 *
 *   1. featured_priority ASC, with NULL treated as "unranked" and sorted last
 *   2. published_at DESC as the tie-break and the default for unranked items
 *
 * So an admin who does nothing but tick `featured` gets pure recency ordering;
 * setting featured_priority lets them pin specific stories to the top.
 *
 * The result is split into one hero item and a ranked list beneath it.
 */

import { createClient } from "@/utils/supabase/server";
import type {
  DBRSSItemWithSource,
  RSSContentType,
} from "@/types/database";

/** Hero + list sizing. 1 hero + 5 list items by default. */
export const TOP_NEWS_HERO_COUNT = 1;
export const TOP_NEWS_LIST_COUNT = 5;
export const TOP_NEWS_DEFAULT_LIMIT = TOP_NEWS_HERO_COUNT + TOP_NEWS_LIST_COUNT;

/** Hard ceiling so a caller-supplied limit can't pull the whole table. */
export const TOP_NEWS_MAX_LIMIT = 20;

const DEFAULT_PLACEHOLDER = "/images/placeholders/article.svg";

/**
 * The public shape of a Top News entry. Deliberately narrow: only the fields
 * the block renders. Internal columns (guid, source_id, content, extracted_*,
 * hidden_by_admin, …) are not exposed.
 */
export interface TopNewsItem {
  id: string;
  headline: string;
  teaser: string;
  slug: string;
  imageUrl: string;
  externalUrl: string;
  publishedAt: string;
  sourceName: string;
  tags: string[];
  contentType: RSSContentType;
  /** 1-based position in the block; the hero is rank 1. */
  rank: number;
}

export interface TopNewsResult {
  /** Highest-ranked featured item, or null when nothing is featured. */
  hero: TopNewsItem | null;
  /** Remaining ranked items below the hero (up to TOP_NEWS_LIST_COUNT). */
  items: TopNewsItem[];
  /** Total featured items considered, before hero/list splitting. */
  total: number;
  error?: string;
}

export interface GetTopNewsOptions {
  /** Total items to return across hero + list. Defaults to 6, capped at 20. */
  limit?: number;
  /** Restrict to a single content type (e.g. only featured articles). */
  contentType?: RSSContentType;
}

/**
 * Order two featured items: hand-ranked first (ascending), then by recency.
 * Kept separate from the query so the ordering rule has one definition and can
 * be applied to already-fetched rows.
 */
export function compareTopNews(
  a: Pick<DBRSSItemWithSource, "featured_priority" | "published_at">,
  b: Pick<DBRSSItemWithSource, "featured_priority" | "published_at">
): number {
  const aPriority = a.featured_priority;
  const bPriority = b.featured_priority;

  // NULL priority sorts after any explicit priority.
  if (aPriority !== bPriority) {
    if (aPriority === null) return 1;
    if (bPriority === null) return -1;
    return aPriority - bPriority;
  }

  return (
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

/** Build the tag list for an item: its own tag, falling back to source name. */
function buildTags(item: DBRSSItemWithSource): string[] {
  const tags: string[] = [];
  if (item.tag) tags.push(item.tag);
  return tags;
}

/** Map a DB row to the narrow public Top News shape. */
export function mapToTopNewsItem(
  item: DBRSSItemWithSource,
  rank: number
): TopNewsItem {
  const source = item.source;
  const youtubeThumb = item.youtube_video_id
    ? `https://img.youtube.com/vi/${item.youtube_video_id}/hqdefault.jpg`
    : null;

  return {
    id: item.id,
    headline: item.title,
    teaser: item.excerpt ?? "",
    slug: item.slug,
    imageUrl:
      item.thumbnail_url ||
      youtubeThumb ||
      source?.image_url ||
      DEFAULT_PLACEHOLDER,
    externalUrl: item.external_url,
    publishedAt: item.published_at,
    sourceName: item.youtube_channel_name || source?.name || "",
    tags: buildTags(item),
    contentType: source?.content_type ?? "article",
    rank,
  };
}

/**
 * Fetch featured items for the Top News block.
 *
 * Filters to is_featured = true and excludes admin-hidden items, then applies
 * the priority/recency ordering and splits hero from list.
 */
export async function getTopNewsItems(
  options: GetTopNewsOptions = {}
): Promise<TopNewsResult> {
  const limit = Math.min(
    Math.max(options.limit ?? TOP_NEWS_DEFAULT_LIMIT, 1),
    TOP_NEWS_MAX_LIMIT
  );

  const empty: TopNewsResult = { hero: null, items: [], total: 0 };

  try {
    const supabase = await createClient();

    // Content-type lives on rss_sources, so a type filter resolves source ids
    // first — same approach as getRSSItemsByType.
    let sourceIds: string[] | null = null;
    if (options.contentType) {
      const { data: sources, error: sourcesError } = await supabase
        .from("rss_sources")
        .select("id")
        .eq("content_type", options.contentType)
        .eq("is_active", true);

      if (sourcesError) {
        return { ...empty, error: sourcesError.message };
      }
      if (!sources || sources.length === 0) {
        return empty;
      }
      sourceIds = sources.map((s) => s.id);
    }

    let query = supabase
      .from("rss_items")
      .select("*, source:rss_sources(*)")
      .eq("is_featured", true)
      .eq("hidden_by_admin", false)
      // Hand-ranked items first; unranked fall to the bottom, then by recency.
      .order("featured_priority", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (sourceIds) {
      query = query.in("source_id", sourceIds);
    }

    const { data, error } = await query;

    if (error) {
      return { ...empty, error: error.message };
    }

    // Drop rows whose source failed to join (inactive/removed source).
    const rows = ((data ?? []) as DBRSSItemWithSource[]).filter(
      (item) => item.source !== null
    );

    // Re-sort defensively: the DB ordering is authoritative, but this keeps
    // hero/list assignment correct if rows were filtered or merged.
    const ordered = [...rows].sort(compareTopNews);
    const ranked = ordered.map((item, index) =>
      mapToTopNewsItem(item, index + 1)
    );

    const hero = ranked[0] ?? null;
    const items = ranked.slice(
      TOP_NEWS_HERO_COUNT,
      TOP_NEWS_HERO_COUNT + TOP_NEWS_LIST_COUNT
    );

    return { hero, items, total: ranked.length };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Failed to fetch Top News",
    };
  }
}
