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
  "media:content"?: { $: { url: string; medium?: string; type?: string } } | { $: { url: string; medium?: string; type?: string } }[];
  "media:group"?: {
    "media:thumbnail"?: { $: { url: string } }[] | { $: { url: string } };
    "media:content"?: { $: { url: string } }[] | { $: { url: string } };
  };
  enclosure?: { url: string; type?: string };
  // Additional WordPress and podcast image fields
  "itunes:image"?: { $?: { href: string } } | string;
  image?: { url?: string } | string;
  "post-thumbnail"?: string;
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
      ["itunes:image", "itunes:image"],
      ["image", "image"],
      ["post-thumbnail", "post-thumbnail"],
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
 * Check if an image URL should be skipped (tracking pixels, icons, etc.)
 */
function shouldSkipImage(src: string): boolean {
  const skipPatterns = [
    'gravatar',
    'feedburner',
    'pixel',
    'spacer',
    'blank.gif',
    '1x1',
    'tracking',
    'badge',
    'icon',
    'favicon',
    'logo',
    'avatar',
    'share',
    'social',
    'twitter',
    'facebook',
    'linkedin',
    'reddit',
  ];
  const lowercaseSrc = src.toLowerCase();
  return skipPatterns.some((pattern) => lowercaseSrc.includes(pattern));
}

/**
 * Extract first relevant image URL from HTML content
 */
function extractImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;

  // Match all <img> tags with src attribute
  const allImgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  
  // Filter and prioritize images
  for (const match of allImgs) {
    const src = match[1];
    if (!src) continue;
    
    // Skip small tracking pixels or icons
    if (shouldSkipImage(src)) continue;
    
    // Skip data URIs (inline images are usually small)
    if (src.startsWith('data:')) continue;
    
    // Check the full img tag for size hints
    const fullTag = match[0];
    // Skip if it's explicitly a small image
    const widthMatch = fullTag.match(/width=["']?(\d+)/i);
    const heightMatch = fullTag.match(/height=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 100) continue;
    if (heightMatch && parseInt(heightMatch[1]) < 100) continue;
    
    return src;
  }
  
  // Fallback: try to find image in srcset (often contains higher quality images)
  const srcsetMatch = html.match(/srcset=["']([^"']+)["']/i);
  if (srcsetMatch && srcsetMatch[1]) {
    // srcset format: "url1 1x, url2 2x" or "url1 300w, url2 600w"
    const sources = srcsetMatch[1].split(',').map((s) => s.trim().split(' ')[0]);
    // Return the last (usually largest) image
    if (sources.length > 0) {
      return sources[sources.length - 1];
    }
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
 * Check if a URL looks like an image
 */
function isImageUrl(url: string): boolean {
  if (!url) return false;
  // Check file extension
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url)) {
    return true;
  }
  // Check for common image hosting patterns
  if (/\/(wp-content\/uploads|images|img|media)\//i.test(url)) {
    return true;
  }
  return false;
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

  // Media content format - check for image type or URL pattern
  if (item["media:content"]) {
    const mediaContent = getMediaUrl(item["media:content"]);
    if (mediaContent) {
      // Check if it's marked as an image or looks like an image URL
      const mediaObj = Array.isArray(item["media:content"])
        ? item["media:content"][0]
        : item["media:content"];
      const medium = mediaObj?.$?.medium;
      const type = mediaObj?.$?.type;
      
      if (
        medium === "image" ||
        type?.startsWith("image/") ||
        isImageUrl(mediaContent)
      ) {
        return mediaContent;
      }
    }
  }

  // Enclosure format (common for podcasts and WordPress)
  if (item.enclosure?.url) {
    const enclosureType = item.enclosure.type || "";
    // Only use enclosure if it's an image type
    if (
      enclosureType.startsWith("image/") ||
      isImageUrl(item.enclosure.url)
    ) {
      return item.enclosure.url;
    }
  }

  // iTunes image (common for podcasts)
  if (item["itunes:image"]) {
    if (typeof item["itunes:image"] === "string") {
      return item["itunes:image"];
    }
    if (item["itunes:image"].$?.href) {
      return item["itunes:image"].$.href;
    }
  }

  // Direct image field (some feeds use this)
  if (item.image) {
    if (typeof item.image === "string") {
      return item.image;
    }
    if (item.image.url) {
      return item.image.url;
    }
  }

  // Post thumbnail (WordPress)
  if (item["post-thumbnail"] && typeof item["post-thumbnail"] === "string") {
    return item["post-thumbnail"];
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

  // Fallback: Try to find YouTube video links in content and use video thumbnail
  // This is especially useful for sites like Peter Attia's that embed YouTube videos
  const contentToScan = item["content:encoded"] || item.content || "";
  if (contentToScan) {
    const youtubeThumbnail = extractYouTubeThumbnailFromHtml(contentToScan);
    if (youtubeThumbnail) return youtubeThumbnail;
  }

  return undefined;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract YouTube thumbnail from HTML content
 * Scans article content for YouTube video links and returns the thumbnail URL
 * of the first video found. Useful for articles that embed YouTube videos.
 */
function extractYouTubeThumbnailFromHtml(html: string): string | undefined {
  if (!html) return undefined;

  // Patterns to find YouTube URLs in HTML content
  // YouTube video IDs are always 11 characters: letters, numbers, underscores, hyphens
  const youtubePatterns = [
    // Standard watch URLs (in href, src, or plain text)
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g,
    // Short URLs
    /youtu\.be\/([a-zA-Z0-9_-]{11})/g,
    // Embed URLs
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
    // YouTube iframe embeds
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
  ];

  for (const pattern of youtubePatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      // Use hqdefault for reliable availability (maxresdefault doesn't exist for all videos)
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }

  return undefined;
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
        categories: item.categories,
      };
    });

    return {
      source: {
        title: decodeHtmlEntities(feed.title || "Unknown Source"),
        link: feed.link || feedConfig.url,
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
