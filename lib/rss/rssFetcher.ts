import Parser from "rss-parser";
import type { RSSFeedConfig, RSSSource, RSSArticle } from "@/types/rss";

// Custom parser with additional fields that health/longevity feeds often include
type CustomItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  "content:encoded"?: string;
  creator?: string;
  "media:thumbnail"?: { $: { url: string } } | { $: { url: string } }[];
  "media:content"?: { $: { url: string } } | { $: { url: string } }[];
  "media:group"?: {
    "media:thumbnail"?: { $: { url: string } }[] | { $: { url: string } };
    "media:content"?: { $: { url: string } }[] | { $: { url: string } };
  };
  enclosure?: { url: string };
};

type CustomFeed = {
  title?: string;
  link?: string;
  image?: { url?: string };
};

const parser: Parser<CustomFeed, CustomItem> = new Parser({
  customFields: {
    item: [
      ["media:thumbnail", "media:thumbnail"],
      ["media:content", "media:content"],
      ["media:group", "media:group"],
      ["content:encoded", "content:encoded"],
      ["dc:creator", "creator"],
    ],
  },
  timeout: 10000,
});

/**
 * Decode HTML entities commonly found in RSS feeds
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

/**
 * Extract first image URL from HTML content
 */
function extractImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;

  // Match <img src="..."> patterns
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    // Skip small tracking pixels or icons
    const src = imgMatch[1];
    if (src.includes('gravatar') || src.includes('feedburner') || src.includes('pixel')) {
      // Try to find another image
      const allImgs = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
      for (const match of allImgs) {
        if (!match[1].includes('gravatar') && !match[1].includes('feedburner') && !match[1].includes('pixel')) {
          return match[1];
        }
      }
    }
    return src;
  }
  return undefined;
}

/**
 * Helper to extract URL from media element (handles array or single object)
 */
function getMediaUrl(
  media: { $: { url: string } } | { $: { url: string } }[] | undefined
): string | undefined {
  if (!media) return undefined;
  if (Array.isArray(media)) {
    return media[0]?.$?.url;
  }
  return media.$?.url;
}

/**
 * Extract thumbnail from various RSS item formats
 */
function extractThumbnail(item: CustomItem): string | undefined {
  // YouTube RSS format - check media:group first (most YouTube feeds use this)
  if (item["media:group"]) {
    const groupThumb = getMediaUrl(item["media:group"]["media:thumbnail"]);
    if (groupThumb) return groupThumb;
  }

  // Direct media:thumbnail
  const directThumb = getMediaUrl(item["media:thumbnail"]);
  if (directThumb) return directThumb;

  // Media content format
  const mediaContent = getMediaUrl(item["media:content"]);
  if (mediaContent && mediaContent.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
    return mediaContent;
  }

  // Enclosure format (common for podcasts)
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  // Try extracting from content HTML
  if (item.content) {
    const fromContent = extractImageFromHtml(item.content);
    if (fromContent) return fromContent;
  }

  // Try content:encoded (full HTML content in many feeds)
  if (item["content:encoded"]) {
    const fromEncoded = extractImageFromHtml(item["content:encoded"]);
    if (fromEncoded) return fromEncoded;
  }

  return undefined;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Process a single RSS feed with timeout and error handling
 */
export async function processFeed(
  feedConfig: RSSFeedConfig,
  timeoutMs: number = 10000
): Promise<RSSSource | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const feed = await parser.parseURL(feedConfig.url);
    clearTimeout(timeoutId);

    const articles: RSSArticle[] = (feed.items || []).slice(0, 10).map((item) => {
      let thumbnail = extractThumbnail(item);

      // For YouTube feeds, generate thumbnail from video ID
      if (!thumbnail && item.link) {
        const videoId = extractYouTubeVideoId(item.link);
        if (videoId) {
          thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }

      return {
        title: decodeHtmlEntities(item.title || ""),
        link: item.link || "",
        thumbnail,
        pubDate: item.pubDate || new Date().toISOString(),
        contentSnippet: decodeHtmlEntities(
          item.contentSnippet || item.content || ""
        ).slice(0, 200),
        creator: item.creator,
      };
    });

    return {
      source: {
        title: decodeHtmlEntities(feed.title || "Unknown Source"),
        link: feed.link || feedConfig.url,
        feedUrl: feedConfig.url, // Store original feed URL for exact matching
        image: feedConfig.image || feed.image?.url,
        type: feedConfig.type,
      },
      articles,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Failed to fetch feed ${feedConfig.url}:`, error);
    return null;
  }
}

/**
 * Fetch and process all configured feeds
 * Uses Promise.allSettled to handle partial failures gracefully
 */
export async function fetchAllFeeds(
  feeds: RSSFeedConfig[]
): Promise<RSSSource[]> {
  const results = await Promise.allSettled(
    feeds.map((feed) => processFeed(feed))
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<RSSSource | null> =>
        result.status === "fulfilled" && result.value !== null
    )
    .map((result) => result.value as RSSSource);
}

/**
 * Format relative date for display
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Generate a URL-friendly slug from a title
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
