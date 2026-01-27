/**
 * RSS API Route
 * 
 * Serves RSS content with the following priority:
 * 1. Persisted data from database (if available)
 * 2. In-memory cache (stale-while-revalidate)
 * 3. Fresh fetch from RSS feeds
 * 
 * Query Parameters:
 * - type: Filter by content type (article, video, topic)
 * - refresh: Force refresh from RSS feeds (bypasses cache)
 * - source: Use 'live' to bypass database and fetch directly from RSS
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchAllFeeds } from "@/lib/rss/rssFetcher";
import {
  getCachedData,
  setCacheData,
  getCacheTimestamp,
  markRevalidating,
  clearRevalidating,
} from "@/lib/rss/cache";
import feedsConfig from "@/data/feeds.json";
import type { RSSAPIResponse, RSSSource, RSSArticle, FeedsConfig, RSSContentType } from "@/types/rss";

// Type assertion for JSON import
const typedFeedsConfig = feedsConfig as FeedsConfig;

export const dynamic = "force-dynamic";

/**
 * Try to get data from the database first
 */
async function getPersistedData(
  typeFilter: string | null
): Promise<RSSSource[] | null> {
  try {
    const supabase = await createClient();

    // Check if we have any sources in the database
    const { count: sourceCount } = await supabase
      .from("rss_sources")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (!sourceCount || sourceCount === 0) {
      return null; // No sources configured, fall back to legacy
    }

    // Build query for sources
    let sourceQuery = supabase
      .from("rss_sources")
      .select("id")
      .eq("is_active", true);

    if (typeFilter) {
      sourceQuery = sourceQuery.eq("content_type", typeFilter);
    }

    const { data: sources } = await sourceQuery;
    const sourceIds = sources?.map((s) => s.id) || [];

    if (sourceIds.length === 0) {
      return [];
    }

    // Get items with source info
    const { data: items } = await supabase
      .from("rss_items")
      .select(
        `
        id,
        guid,
        title,
        slug,
        excerpt,
        external_url,
        thumbnail_url,
        author,
        published_at,
        source:rss_sources(
          id,
          name,
          website_url,
          image_url,
          content_type
        )
      `
      )
      .in("source_id", sourceIds)
      .order("published_at", { ascending: false })
      .limit(50);

    if (!items || items.length === 0) {
      return null; // No items, fall back to legacy
    }

    // Group by source
    const sourceMap = new Map<string, RSSSource>();

    type SourceType = {
      id: string;
      name: string;
      website_url: string | null;
      image_url: string | null;
      content_type: RSSContentType;
    };

    for (const item of items) {
      // Supabase returns nested relations as objects
      const source = (item.source as unknown) as SourceType | null;

      if (!source) continue;

      const sourceKey = source.id;

      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, {
          source: {
            title: source.name,
            link: source.website_url || "",
            image: source.image_url || undefined,
            type: source.content_type,
          },
          articles: [],
        });
      }

      const rssArticle: RSSArticle = {
        title: item.title,
        link: item.external_url,
        thumbnail: item.thumbnail_url || undefined,
        pubDate: item.published_at,
        contentSnippet: item.excerpt || undefined,
        creator: item.author || undefined,
      };

      sourceMap.get(sourceKey)!.articles.push(rssArticle);
    }

    return Array.from(sourceMap.values());
  } catch (error) {
    console.error("[RSS API] Database query failed:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const forceRefresh = searchParams.get("refresh") === "true";
  const source = searchParams.get("source");

  try {
    // If not forcing live source, try database first
    if (source !== "live" && !forceRefresh) {
      const persistedData = await getPersistedData(typeFilter);
      
      if (persistedData && persistedData.length > 0) {
        console.log("[RSS API] Serving from database");
        return NextResponse.json(
          {
            sources: persistedData,
            fromDatabase: true,
          } as RSSAPIResponse & { fromDatabase: boolean },
          {
            headers: {
              "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
              "X-Data-Source": "database",
            },
          }
        );
      }
    }

    // Fall back to legacy in-memory cache / direct fetch
    console.log("[RSS API] Falling back to direct RSS fetch");

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cachedData, isStale, needsRevalidation } = getCachedData();

      if (cachedData && !needsRevalidation) {
        // Fresh cache - return immediately
        return createResponse(cachedData, typeFilter, getCacheTimestamp());
      }

      if (cachedData && isStale) {
        // Stale cache - return immediately but trigger background refresh
        if (markRevalidating()) {
          // Don't await - let it run in background
          refreshInBackground();
        }
        return createResponse(cachedData, typeFilter, getCacheTimestamp());
      }
    }

    // No cache or force refresh - fetch fresh data
    console.log("[RSS API] Fetching fresh data from RSS feeds...");
    const sources = await fetchAllFeeds(typedFeedsConfig.feeds);

    if (sources.length === 0) {
      // All feeds failed - return error but check for stale cache as fallback
      const { data: staleData } = getCachedData();
      if (staleData) {
        return createResponse(staleData, typeFilter, getCacheTimestamp(), true);
      }
      return NextResponse.json(
        { sources: [], error: "Failed to fetch any feeds" } as RSSAPIResponse,
        { status: 503 }
      );
    }

    // Update cache
    setCacheData(sources);

    return createResponse(sources, typeFilter, getCacheTimestamp());
  } catch (error) {
    console.error("[RSS API] Error:", error);

    // Try to return stale cache on error
    const { data: staleData } = getCachedData();
    if (staleData) {
      return createResponse(staleData, typeFilter, getCacheTimestamp(), true);
    }

    return NextResponse.json(
      {
        sources: [],
        error: "Internal server error",
      } as RSSAPIResponse,
      { status: 500 }
    );
  }
}

/**
 * Background refresh without blocking the response
 */
async function refreshInBackground(): Promise<void> {
  try {
    const sources = await fetchAllFeeds(typedFeedsConfig.feeds);
    if (sources.length > 0) {
      setCacheData(sources);
    }
  } catch (error) {
    console.error("[RSS API] Background refresh failed:", error);
  } finally {
    clearRevalidating();
  }
}

/**
 * Create a consistent response with proper headers
 */
function createResponse(
  sources: Awaited<ReturnType<typeof fetchAllFeeds>>,
  typeFilter: string | null,
  cachedAt: string | null,
  isStale = false
): NextResponse {
  // Filter by type if specified
  let filteredSources = sources;
  if (typeFilter) {
    filteredSources = sources.filter((s) => s.source.type === typeFilter);
  }

  const response: RSSAPIResponse = {
    sources: filteredSources,
    cachedAt: cachedAt || undefined,
  };

  return NextResponse.json(response, {
    headers: {
      // CDN cache for 5 minutes, allow stale for 1 hour
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "X-Cache-Status": isStale ? "STALE" : cachedAt ? "HIT" : "MISS",
      "X-Data-Source": "rss-direct",
    },
  });
}
