// RSS Content Type
export type RSSContentType = "article" | "video" | "topic";

// RSS Feed Configuration Types
export interface RSSFeedConfig {
  url: string;
  type: RSSContentType;
  image?: string;
  name?: string;
  isTopChannel?: boolean;
  isPodcast?: boolean;
}

export interface FeedsConfig {
  feeds: RSSFeedConfig[];
}

// Parsed RSS Item Types
export interface RSSArticle {
  title: string;
  link: string;
  thumbnail?: string;
  pubDate: string;
  contentSnippet?: string;
  creator?: string;
}

// Source with its articles
export interface RSSSource {
  source: {
    title: string;
    link: string;
    image?: string;
    type: RSSContentType;
  };
  articles: RSSArticle[];
}

// API Response Type
export interface RSSAPIResponse {
  sources: RSSSource[];
  cachedAt?: string;
  error?: string;
}

// ============================================================================
// YOUTUBE RSS SPECIFIC TYPES
// ============================================================================

/**
 * YouTube RSS feed item with all extractable fields
 * YouTube's official RSS format: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 */
export interface YouTubeRSSItem {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  link: string;
  published: string;
  updated: string;
  thumbnailUrl: string;
  description: string;
  // Derived/computed fields
  thumbnailUrlHQ: string; // High quality version
}

/**
 * YouTube channel metadata from RSS feed
 */
export interface YouTubeChannelFromRSS {
  channelId: string;
  name: string;
  channelUrl: string;
}

// ============================================================================
// NORMALIZED CONTENT TYPES
// ============================================================================

/**
 * Normalized content item that unifies all RSS source types
 * This is the standardized format used throughout the application
 */
export interface NormalizedRSSItem {
  // Identification
  guid: string; // Unique identifier (URL for articles, video ID for YouTube)
  sourceId?: string; // Database source ID (if persisted)
  
  // Core content
  title: string;
  slug: string;
  excerpt: string;
  externalUrl: string;
  thumbnailUrl?: string;
  
  // Metadata
  author: string;
  publishedAt: string;
  contentType: "article" | "video" | "topic";
  
  // Source info
  sourceName: string;
  sourceUrl: string;
  sourceImage?: string;
  
  // Video-specific (YouTube)
  videoId?: string;
  channelId?: string;
  channelName?: string;
  duration?: string;
  viewCount?: string;
  
  // Internal tracking
  ingestedAt?: string;
}

// ============================================================================
// INGESTION TYPES
// ============================================================================

/**
 * Result of processing a single feed
 */
export interface FeedProcessingResult {
  sourceId?: string;
  feedUrl: string;
  sourceName: string;
  success: boolean;
  itemsFound: number;
  itemsIngested: number;
  itemsSkipped: number;
  error?: string;
}

/**
 * Result of a full ingestion run
 */
export interface IngestionResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "completed" | "partial" | "failed";
  sourcesProcessed: number;
  sourcesFailed: number;
  totalItemsIngested: number;
  totalItemsSkipped: number;
  feedResults: FeedProcessingResult[];
  error?: string;
}

/**
 * Options for the ingestion process
 */
export interface IngestionOptions {
  /** Only process specific source IDs */
  sourceIds?: string[];
  /** Only process specific content types */
  contentTypes?: ("article" | "video" | "topic")[];
  /** Force re-fetch even if recently fetched */
  force?: boolean;
  /** Maximum items to process per source */
  maxItemsPerSource?: number;
  /** Timeout in ms for each feed */
  timeoutMs?: number;
}
