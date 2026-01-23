import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/rss/rssFetcher";
import {
  getCachedData,
  setCacheData,
  getCacheTimestamp,
  markRevalidating,
  clearRevalidating,
} from "@/lib/rss/cache";
import feedsConfig from "@/data/feeds.json";
import type { RSSAPIResponse, FeedsConfig } from "@/types/rss";

// Type assertion for JSON import
const typedFeedsConfig = feedsConfig as FeedsConfig;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
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
    console.log("[RSS API] Fetching fresh data...");
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
    },
  });
}
