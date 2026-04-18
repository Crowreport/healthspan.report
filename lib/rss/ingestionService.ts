/**
 * RSS Content Ingestion Service
 * 
 * Handles periodic polling, deduplication, and normalization of RSS content.
 * Supports both regular RSS feeds and YouTube's RSS format.
 */

import Parser from "rss-parser";
import https from "node:https";
import { createClient } from "@/utils/supabase/server";
import type {
  DBRSSSource,
  DBRSSItem,
  CreateRSSItemInput,
} from "@/types/database";
import type {
  NormalizedRSSItem,
  FeedProcessingResult,
  IngestionResult,
  IngestionOptions,
} from "@/types/rss";
import { processFeed, slugify, decodeHtmlEntities } from "./rssFetcher";
import {
  isYouTubeFeed,
  getChannelIdFromFeedUrl,
} from "./youtubeParser";

type YouTubeAtomFeed = {
  title?: string;
  link?: string;
};

type YouTubeAtomEntry = {
  id?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  mediaGroup?: {
    "media:thumbnail"?:
      | { $: { url: string; width?: string; height?: string } }[]
      | { $: { url: string; width?: string; height?: string } };
  };
  mediaThumbnail?:
    | { $: { url: string; width?: string; height?: string } }[]
    | { $: { url: string; width?: string; height?: string } };
};

const youtubeAtomParser: Parser<YouTubeAtomFeed, YouTubeAtomEntry> = new Parser({
  customFields: {
    item: [
      ["media:group", "mediaGroup"],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
  timeout: 15000,
});

async function fetchYouTubeFeedXml(
  url: string,
  timeoutMs: number
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/atom+xml,application/xml,text/xml,*/*",
        },
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`Status code ${statusCode}`));
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve(body);
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.on("error", reject);
  });
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize a YouTube RSS item to our standard format
 */
function normalizeYouTubeItem(
  item: import("@/types/rss").YouTubeRSSItem,
  source: DBRSSSource
): NormalizedRSSItem {
  return {
    guid: item.videoId,
    title: item.title,
    slug: slugify(item.title),
    excerpt: item.description || "",
    externalUrl: item.link,
    thumbnailUrl: item.thumbnailUrl,
    author: item.channelName,
    publishedAt: item.published,
    contentType: "video",
    sourceName: source.name,
    sourceUrl: source.website_url || source.feed_url,
    sourceImage: source.image_url || undefined,
    videoId: item.videoId,
    channelId: item.channelId,
    channelName: item.channelName,
  };
}

/**
 * Normalize a regular RSS article to our standard format
 */
function normalizeRSSArticle(
  item: {
    title: string;
    link: string;
    thumbnail?: string;
    pubDate: string;
    contentSnippet?: string;
    creator?: string;
  },
  source: DBRSSSource
): NormalizedRSSItem {
  return {
    guid: item.link,
    title: item.title,
    slug: slugify(item.title),
    excerpt: item.contentSnippet || "",
    externalUrl: item.link,
    thumbnailUrl: item.thumbnail,
    author: item.creator || source.name,
    publishedAt: item.pubDate,
    contentType: source.content_type,
    sourceName: source.name,
    sourceUrl: source.website_url || source.feed_url,
    sourceImage: source.image_url || undefined,
  };
}

/**
 * Normalize a regular RSS video item to our standard format
 */
function normalizeRSSVideo(
  item: {
    title: string;
    link: string;
    thumbnail?: string;
    pubDate: string;
    contentSnippet?: string;
    creator?: string;
  },
  source: DBRSSSource
): NormalizedRSSItem {
  return {
    guid: item.link,
    title: item.title,
    slug: slugify(item.title),
    excerpt: item.contentSnippet || "",
    externalUrl: item.link,
    thumbnailUrl: item.thumbnail,
    author: item.creator || source.name,
    publishedAt: item.pubDate,
    contentType: "video",
    sourceName: source.name,
    sourceUrl: source.website_url || source.feed_url,
    sourceImage: source.image_url || undefined,
  };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Get all active RSS sources from the database
 */
async function getActiveSources(
  options?: IngestionOptions
): Promise<DBRSSSource[]> {
  const supabase = await createClient();

  let query = supabase
    .from("rss_sources")
    .select("*")
    .eq("is_active", true)
    .order("last_fetched_at", { ascending: true, nullsFirst: true });

  if (options?.sourceIds && options.sourceIds.length > 0) {
    query = query.in("id", options.sourceIds);
  }

  if (options?.contentTypes && options.contentTypes.length > 0) {
    query = query.in("content_type", options.contentTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Ingestion] Failed to fetch sources:", error);
    return [];
  }

  return data as DBRSSSource[];
}

/**
 * Check if an item already exists (deduplication)
 */
async function itemExists(
  sourceId: string,
  guid: string
): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("rss_items")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("guid", guid);

  if (error) {
    console.error("[Ingestion] Failed to check item existence:", error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Batch insert new items (with deduplication via upsert)
 */
async function insertItems(
  items: CreateRSSItemInput[]
): Promise<{ inserted: number; skipped: number }> {
  if (items.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const supabase = await createClient();

  // Use upsert with ON CONFLICT DO NOTHING to handle duplicates
  const { data, error } = await supabase
    .from("rss_items")
    .upsert(items, {
      onConflict: "source_id,guid",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    console.error("[Ingestion] Failed to insert items:", error);
    return { inserted: 0, skipped: items.length };
  }

  const inserted = data?.length || 0;
  return { inserted, skipped: items.length - inserted };
}

/**
 * Update source fetch metadata
 */
async function updateSourceFetchStatus(
  sourceId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    last_fetched_at: new Date().toISOString(),
  };

  if (success) {
    updates.last_fetch_error = null;
    updates.fetch_count = supabase.rpc("increment_fetch_count", {
      source_id: sourceId,
    });
  } else {
    updates.last_fetch_error = error || "Unknown error";
    updates.error_count = supabase.rpc("increment_error_count", {
      source_id: sourceId,
    });
  }

  // Simple update without RPC (RPC would need separate functions)
  const { error: updateError } = await supabase
    .from("rss_sources")
    .update({
      last_fetched_at: new Date().toISOString(),
      last_fetch_error: success ? null : (error || "Unknown error"),
    })
    .eq("id", sourceId);

  if (updateError) {
    console.error(
      "[Ingestion] Failed to update source status:",
      updateError
    );
  }
}

/**
 * Create an ingestion log entry
 */
async function createIngestionLog(): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rss_ingestion_log")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (error) {
    console.error("[Ingestion] Failed to create log entry:", error);
    return null;
  }

  return data.id;
}

/**
 * Update ingestion log with results
 */
async function updateIngestionLog(
  logId: string,
  result: Omit<IngestionResult, "runId">
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("rss_ingestion_log")
    .update({
      completed_at: result.completedAt,
      duration_ms: result.durationMs,
      status: result.status,
      sources_processed: result.sourcesProcessed,
      sources_failed: result.sourcesFailed,
      items_ingested: result.totalItemsIngested,
      items_skipped: result.totalItemsSkipped,
      error_message: result.error || null,
      details: { feedResults: result.feedResults },
    })
    .eq("id", logId);

  if (error) {
    console.error("[Ingestion] Failed to update log:", error);
  }
}

// ============================================================================
// FEED PROCESSING
// ============================================================================

/**
 * Process a single YouTube feed
 */
async function processYouTubeFeed(
  source: DBRSSSource,
  options?: IngestionOptions
): Promise<FeedProcessingResult> {
  const result: FeedProcessingResult = {
    sourceId: source.id,
    feedUrl: source.feed_url,
    sourceName: source.name,
    success: false,
    itemsFound: 0,
    itemsIngested: 0,
    itemsSkipped: 0,
  };

  try {
    const timeoutMs = options?.timeoutMs || 15000;
    const xml = await fetchYouTubeFeedXml(source.feed_url, timeoutMs);
    const feed = await youtubeAtomParser.parseString(xml);
    const entries = feed.items || [];
    result.itemsFound = entries.length;

    // Limit items if specified
    const maxItems = options?.maxItemsPerSource || 15;
    const itemsToProcess = entries.slice(0, maxItems);

    const extractThumbnail = (entry: YouTubeAtomEntry): string | undefined => {
      const groupThumb = entry.mediaGroup?.["media:thumbnail"];
      if (Array.isArray(groupThumb) && groupThumb.length > 0) {
        return groupThumb[0]?.$?.url;
      }
      if (groupThumb && !Array.isArray(groupThumb)) {
        return groupThumb.$?.url;
      }

      const directThumb = entry.mediaThumbnail;
      if (Array.isArray(directThumb) && directThumb.length > 0) {
        return directThumb[0]?.$?.url;
      }
      if (directThumb && !Array.isArray(directThumb)) {
        return directThumb.$?.url;
      }

      return undefined;
    };

    // Normalize and prepare for insertion
    const normalizedItems: CreateRSSItemInput[] = itemsToProcess.flatMap(
      (entry) => {
        const guid = entry.id || "";
        const title = decodeHtmlEntities(entry.title || "");
        const externalUrl = entry.link || "";
        const publishedAt = entry.pubDate || entry.isoDate || "";
        const thumbnailUrl = extractThumbnail(entry);

        if (!guid || !title || !externalUrl || !publishedAt) {
          return [];
        }

        return [
          {
            source_id: source.id,
            guid,
            title,
            slug: slugify(title),
            excerpt: "",
            external_url: externalUrl,
            thumbnail_url: thumbnailUrl,
            author: source.name,
            published_at: publishedAt,
            youtube_video_id: (() => {
              const match =
                guid.match(/yt:video:([^:]+)$/) ||
                externalUrl.match(/[?&]v=([^&]+)/);
              return match ? match[1] : undefined;
            })(),
            youtube_channel_name: source.name,
          } satisfies CreateRSSItemInput,
        ];
      }
    );

    if (normalizedItems.length === 0) {
      result.error = "Failed to parse YouTube feed";
      return result;
    }

    // Insert with deduplication
    const { inserted, skipped } = await insertItems(normalizedItems);
    result.itemsIngested = inserted;
    result.itemsSkipped = skipped;
    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
  }

  return result;
}

/**
 * Process a regular RSS feed (articles, topics)
 */
async function processRegularFeed(
  source: DBRSSSource,
  options?: IngestionOptions
): Promise<FeedProcessingResult> {
  const result: FeedProcessingResult = {
    sourceId: source.id,
    feedUrl: source.feed_url,
    sourceName: source.name,
    success: false,
    itemsFound: 0,
    itemsIngested: 0,
    itemsSkipped: 0,
  };

  try {
    const parsed = await processFeed({
      url: source.feed_url,
      type: source.content_type,
      image: source.image_url || undefined,
    });

    if (!parsed) {
      result.error = "Failed to parse RSS feed";
      return result;
    }

    result.itemsFound = parsed.articles.length;

    // Limit items if specified
    const maxItems = options?.maxItemsPerSource || 15;
    const itemsToProcess = parsed.articles.slice(0, maxItems);

    // Normalize and prepare for insertion
    const normalizedItems: CreateRSSItemInput[] = itemsToProcess.map(
      (item) => {
        const normalized =
          source.content_type === "video"
            ? normalizeRSSVideo(item, source)
            : normalizeRSSArticle(item, source);
        return {
          source_id: source.id,
          guid: normalized.guid,
          title: normalized.title,
          slug: normalized.slug,
          excerpt: normalized.excerpt,
          external_url: normalized.externalUrl,
          thumbnail_url: normalized.thumbnailUrl,
          author: normalized.author,
          published_at: normalized.publishedAt,
        };
      }
    );

    // Insert with deduplication
    const { inserted, skipped } = await insertItems(normalizedItems);
    result.itemsIngested = inserted;
    result.itemsSkipped = skipped;
    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
  }

  return result;
}

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

/**
 * Run the full ingestion process
 * 
 * This function:
 * 1. Fetches all active RSS sources from the database
 * 2. Processes each feed (YouTube or regular)
 * 3. Normalizes content to a unified format
 * 4. Deduplicates using guid (URL for articles, video ID for YouTube)
 * 5. Persists new items to the database
 * 6. Logs the ingestion run
 */
export async function runIngestion(
  options?: IngestionOptions
): Promise<IngestionResult> {
  const startTime = Date.now();
  const runId = await createIngestionLog();

  console.log("[Ingestion] Starting ingestion run...");

  const feedResults: FeedProcessingResult[] = [];
  let totalIngested = 0;
  let totalSkipped = 0;
  let sourcesFailed = 0;

  try {
    // Get sources to process
    const sources = await getActiveSources(options);
    console.log(`[Ingestion] Processing ${sources.length} sources...`);

    // Process each source
    for (const source of sources) {
      console.log(`[Ingestion] Processing: ${source.name} (${source.content_type})`);

      let result: FeedProcessingResult;

      // YouTube uses Atom feeds
      if (source.feed_url.includes("youtube.com/feeds/videos.xml")) {
        result = await processYouTubeFeed(source, options);
      } else {
        result = await processRegularFeed(source, options);
      }

      feedResults.push(result);

      if (result.success) {
        totalIngested += result.itemsIngested;
        totalSkipped += result.itemsSkipped;
        await updateSourceFetchStatus(source.id, true);
        console.log(
          `[Ingestion] ✓ ${source.name}: ${result.itemsIngested} new, ${result.itemsSkipped} skipped`
        );
      } else {
        sourcesFailed++;
        await updateSourceFetchStatus(source.id, false, result.error);
        console.log(`[Ingestion] ✗ ${source.name}: ${result.error}`);
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const ingestionResult: IngestionResult = {
      runId: runId || "unknown",
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
      durationMs,
      status:
        sourcesFailed === 0
          ? "completed"
          : sourcesFailed === sources.length
          ? "failed"
          : "partial",
      sourcesProcessed: sources.length,
      sourcesFailed,
      totalItemsIngested: totalIngested,
      totalItemsSkipped: totalSkipped,
      feedResults,
    };

    // Update log
    if (runId) {
      await updateIngestionLog(runId, ingestionResult);
    }

    console.log(
      `[Ingestion] Complete: ${totalIngested} items ingested, ${totalSkipped} skipped, ${sourcesFailed} sources failed`
    );

    return ingestionResult;
  } catch (error) {
    const endTime = Date.now();
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const ingestionResult: IngestionResult = {
      runId: runId || "unknown",
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
      durationMs: endTime - startTime,
      status: "failed",
      sourcesProcessed: feedResults.length,
      sourcesFailed,
      totalItemsIngested: totalIngested,
      totalItemsSkipped: totalSkipped,
      feedResults,
      error: errorMessage,
    };

    if (runId) {
      await updateIngestionLog(runId, ingestionResult);
    }

    console.error("[Ingestion] Failed:", errorMessage);
    return ingestionResult;
  }
}

/**
 * Seed initial RSS sources from feeds.json config
 * Call this to populate the database with the configured feeds
 */
export async function seedRSSSources(): Promise<{
  created: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = await createClient();

  // Import feeds config
  const feedsConfig = await import("@/data/feeds.json");
  const feeds = feedsConfig.feeds;

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const feed of feeds) {
    const isYouTube = isYouTubeFeed(feed.url);
    const channelId = isYouTube ? getChannelIdFromFeedUrl(feed.url) : null;

    // Generate a slug from the URL or name
    let slug: string;
    if (channelId) {
      slug = `youtube-${channelId.toLowerCase()}`;
    } else {
      const urlObj = new URL(feed.url);
      slug = slugify(urlObj.hostname.replace("www.", ""));
    }

    // Use provided name or generate from slug
    const name = feed.name || slug
      .split("-")
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

    const sourceData = {
      name,
      slug,
      feed_url: feed.url,
      image_url: feed.image || null,
      content_type: feed.type,
      youtube_channel_id: channelId,
      is_youtube_feed: isYouTube,
      is_active: true,
      is_featured: feed.isTopChannel || false,
    };

    const { error } = await supabase
      .from("rss_sources")
      .upsert(sourceData, { onConflict: "feed_url", ignoreDuplicates: true });

    if (error) {
      if (error.code === "23505") {
        // Unique violation - already exists
        skipped++;
      } else {
        errors.push(`${feed.url}: ${error.message}`);
      }
    } else {
      created++;
    }
  }

  return { created, skipped, errors };
}
