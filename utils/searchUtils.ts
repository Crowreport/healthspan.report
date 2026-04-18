import type { RSSSource } from "@/types/rss";

export type SearchItemType = "article" | "video";

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  summary: string;
  sourceName: string;
  publishedAt: string;
  publishedLabel: string;
  imageUrl: string;
  href: string;
}

interface RankedSearchItem {
  item: SearchItem;
  score: number;
  publishedTime: number;
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function mapSourcesToSearchItems(
  sources: RSSSource[],
  type: SearchItemType
): SearchItem[] {
  const items: SearchItem[] = [];

  for (const source of sources) {
    for (const entry of source.articles) {
      items.push({
        id: entry.link || `${type}-${source.source.feedUrl}-${entry.title}`,
        type,
        title: entry.title || "Untitled",
        summary:
          type === "article"
            ? entry.contentSnippet || "Read the full article from the source."
            : source.source.title,
        sourceName: source.source.title,
        publishedAt: entry.pubDate,
        publishedLabel: formatDate(entry.pubDate),
        imageUrl: resolveImageUrl(
          entry.thumbnail,
          source.source.image,
          type === "article"
            ? "/images/placeholders/article.svg"
            : "/images/placeholders/video.svg"
        ),
        href: entry.link || (type === "article" ? "/articles" : "/videos"),
      });
    }
  }

  return items.sort((left, right) => {
    const leftTime = safeTime(left.publishedAt);
    const rightTime = safeTime(right.publishedAt);
    return rightTime - leftTime;
  });
}

export function searchItems(
  items: SearchItem[],
  query: string,
  limit = 60
): SearchItem[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const ranked = items
    .map((item) => scoreItem(item, normalizedQuery))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.publishedTime - left.publishedTime;
    });

  return ranked.slice(0, limit).map((candidate) => candidate.item);
}

export function getSearchSuggestions(
  items: SearchItem[],
  query: string,
  limit = 6
): SearchItem[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const ranked = searchItems(items, normalizedQuery, limit * 4);
  const seenTitles = new Set<string>();
  const suggestions: SearchItem[] = [];

  for (const item of ranked) {
    const key = item.title.trim().toLowerCase();
    if (!key || seenTitles.has(key)) {
      continue;
    }
    seenTitles.add(key);
    suggestions.push(item);
    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}

function scoreItem(item: SearchItem, query: string): RankedSearchItem {
  const title = item.title.toLowerCase();
  const sourceName = item.sourceName.toLowerCase();
  const summary = item.summary.toLowerCase();

  let score = 0;

  if (title === query) {
    score += 150;
  } else if (title.startsWith(query)) {
    score += 110;
  } else if (title.includes(query)) {
    score += 70;
  }

  if (sourceName.startsWith(query)) {
    score += 45;
  } else if (sourceName.includes(query)) {
    score += 25;
  }

  if (summary.includes(query)) {
    score += 15;
  }

  if (item.type === "video") {
    score += 4;
  }

  return {
    item,
    score,
    publishedTime: safeTime(item.publishedAt),
  };
}

function resolveImageUrl(
  primary: string | undefined,
  secondary: string | undefined,
  fallback: string
): string {
  return normalizeImageUrl(primary) || normalizeImageUrl(secondary) || fallback;
}

function normalizeImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("/")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, "https://");
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;

  return null;
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

function safeTime(rawDate: string): number {
  const date = new Date(rawDate).getTime();
  return Number.isNaN(date) ? 0 : date;
}
