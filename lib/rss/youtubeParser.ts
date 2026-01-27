/**
 * YouTube RSS Feed Parser
 * 
 * Parses YouTube's official RSS feed format:
 * https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 * 
 * YouTube RSS feeds follow Atom format with media extensions.
 * Reference: https://9to5google.com/guides/youtube/feed/
 */

import Parser from "rss-parser";
import type { YouTubeRSSItem, YouTubeChannelFromRSS } from "@/types/rss";
import { decodeHtmlEntities } from "./rssFetcher";

// YouTube RSS feeds use Atom format with custom namespaces
type YouTubeRSSFeed = {
  title?: string;
  link?: string;
  author?: { name?: string; uri?: string };
};

type YouTubeRSSEntry = {
  id?: string; // yt:video:VIDEO_ID format
  title?: string;
  link?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
  author?: { name?: string; uri?: string };
  "media:group"?: {
    "media:title"?: string;
    "media:description"?: string;
    "media:thumbnail"?: { $: { url: string; width?: string; height?: string } }[] | { $: { url: string } };
    "media:content"?: { $: { url: string } };
  };
  "yt:videoId"?: string;
  "yt:channelId"?: string;
};

// Configure parser for YouTube's Atom/RSS format
const youtubeParser: Parser<YouTubeRSSFeed, YouTubeRSSEntry> = new Parser({
  customFields: {
    feed: ["author"] as const,
    item: [
      ["yt:videoId", "yt:videoId"],
      ["yt:channelId", "yt:channelId"],
      ["media:group", "media:group"],
      ["published", "published"],
      ["updated", "updated"],
      ["author", "author"],
    ],
  },
  timeout: 15000,
});

/**
 * Extract YouTube video ID from various formats
 */
export function extractVideoId(entry: YouTubeRSSEntry): string | null {
  // Direct yt:videoId element
  if (entry["yt:videoId"]) {
    return entry["yt:videoId"];
  }

  // From id element (format: "yt:video:VIDEO_ID")
  if (entry.id) {
    const match = entry.id.match(/yt:video:(.+)/);
    if (match) return match[1];
  }

  // From link URL
  if (entry.link) {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/,
    ];
    for (const pattern of patterns) {
      const match = entry.link.match(pattern);
      if (match) return match[1];
    }
  }

  return null;
}

/**
 * Extract channel ID from entry or feed
 */
export function extractChannelId(
  entry: YouTubeRSSEntry,
  feedUrl: string
): string | null {
  // Direct yt:channelId element
  if (entry["yt:channelId"]) {
    return entry["yt:channelId"];
  }

  // From author URI (format: https://www.youtube.com/channel/CHANNEL_ID)
  if (entry.author?.uri) {
    const match = entry.author.uri.match(/youtube\.com\/channel\/([^/?]+)/);
    if (match) return match[1];
  }

  // From feed URL
  const feedMatch = feedUrl.match(/channel_id=([^&]+)/);
  if (feedMatch) return feedMatch[1];

  return null;
}

/**
 * Generate YouTube thumbnail URLs in various qualities
 */
export function generateThumbnailUrls(videoId: string): {
  default: string;
  medium: string;
  high: string;
  maxres: string;
} {
  const base = `https://img.youtube.com/vi/${videoId}`;
  return {
    default: `${base}/default.jpg`, // 120x90
    medium: `${base}/mqdefault.jpg`, // 320x180
    high: `${base}/hqdefault.jpg`, // 480x360
    maxres: `${base}/maxresdefault.jpg`, // 1280x720 (may not exist)
  };
}

/**
 * Extract thumbnail from media:group
 */
function extractMediaThumbnail(
  mediaGroup: YouTubeRSSEntry["media:group"]
): string | undefined {
  if (!mediaGroup?.["media:thumbnail"]) return undefined;

  const thumbnail = mediaGroup["media:thumbnail"];
  if (Array.isArray(thumbnail)) {
    // Get highest quality thumbnail
    const sorted = [...thumbnail].sort((a, b) => {
      const widthA = parseInt(a.$?.width || "0", 10);
      const widthB = parseInt(b.$?.width || "0", 10);
      return widthB - widthA;
    });
    return sorted[0]?.$?.url;
  }

  return thumbnail.$?.url;
}

/**
 * Parse a YouTube RSS feed URL
 */
export async function parseYouTubeFeed(
  feedUrl: string,
  timeoutMs: number = 15000
): Promise<{
  channel: YouTubeChannelFromRSS;
  items: YouTubeRSSItem[];
} | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const feed = await youtubeParser.parseURL(feedUrl);
    clearTimeout(timeoutId);

    // Extract channel info
    const channelId = extractChannelId(feed.items?.[0] || {}, feedUrl);
    const channel: YouTubeChannelFromRSS = {
      channelId: channelId || "",
      name: decodeHtmlEntities(
        feed.author?.name || feed.title || "Unknown Channel"
      ),
      channelUrl: feed.author?.uri || feed.link || "",
    };

    // Parse video items
    const items: YouTubeRSSItem[] = (feed.items || [])
      .map((entry): YouTubeRSSItem | null => {
        const videoId = extractVideoId(entry);
        if (!videoId) return null;

        const entryChannelId = extractChannelId(entry, feedUrl);
        const thumbnails = generateThumbnailUrls(videoId);

        // Try to get thumbnail from media:group first, fallback to generated
        const mediaThumbnail = extractMediaThumbnail(entry["media:group"]);

        // Get description from media:group
        const description = entry["media:group"]?.["media:description"];
        const descText =
          typeof description === "string" ? description : "";

        return {
          videoId,
          channelId: entryChannelId || channel.channelId,
          channelName:
            entry.author?.name ||
            channel.name,
          title: decodeHtmlEntities(entry.title || ""),
          link:
            entry.link || `https://www.youtube.com/watch?v=${videoId}`,
          published:
            entry.published || entry.pubDate || new Date().toISOString(),
          updated: entry.updated || entry.published || entry.pubDate || "",
          thumbnailUrl: mediaThumbnail || thumbnails.high,
          thumbnailUrlHQ: thumbnails.maxres,
          description: decodeHtmlEntities(descText).slice(0, 500),
        };
      })
      .filter((item): item is YouTubeRSSItem => item !== null);

    return { channel, items };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[YouTube Parser] Failed to parse feed ${feedUrl}:`, error);
    return null;
  }
}

/**
 * Check if a URL is a YouTube RSS feed
 */
export function isYouTubeFeed(url: string): boolean {
  return (
    url.includes("youtube.com/feeds/videos.xml") ||
    url.includes("youtube.com/feeds/videos.xml")
  );
}

/**
 * Extract channel ID from a YouTube feed URL
 */
export function getChannelIdFromFeedUrl(url: string): string | null {
  const match = url.match(/channel_id=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Generate YouTube RSS feed URL from channel ID
 */
export function generateYouTubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}
