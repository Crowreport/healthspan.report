import type { RSSSource } from "@/types/rss";

interface CacheEntry {
  data: RSSSource[];
  timestamp: number;
  isRevalidating?: boolean;
}

// Simple in-memory cache
let cache: CacheEntry | null = null;

// Cache TTL in milliseconds (15 minutes)
const CACHE_TTL = 15 * 60 * 1000;

// Stale threshold - serve stale data while revalidating (30 minutes)
const STALE_TTL = 30 * 60 * 1000;

/**
 * Get cached RSS data if available and not expired
 */
export function getCachedData(): {
  data: RSSSource[] | null;
  isStale: boolean;
  needsRevalidation: boolean;
} {
  if (!cache) {
    return { data: null, isStale: false, needsRevalidation: true };
  }

  const age = Date.now() - cache.timestamp;

  // Fresh cache - return immediately
  if (age < CACHE_TTL) {
    return { data: cache.data, isStale: false, needsRevalidation: false };
  }

  // Stale but usable - return but trigger revalidation
  if (age < STALE_TTL) {
    return { data: cache.data, isStale: true, needsRevalidation: true };
  }

  // Too stale - don't return
  return { data: null, isStale: false, needsRevalidation: true };
}

/**
 * Set cache data
 */
export function setCacheData(data: RSSSource[]): void {
  cache = {
    data,
    timestamp: Date.now(),
    isRevalidating: false,
  };
}

/**
 * Mark cache as currently revalidating to prevent duplicate fetches
 */
export function markRevalidating(): boolean {
  if (cache?.isRevalidating) {
    return false; // Already revalidating
  }
  if (cache) {
    cache.isRevalidating = true;
  }
  return true;
}

/**
 * Clear revalidating flag
 */
export function clearRevalidating(): void {
  if (cache) {
    cache.isRevalidating = false;
  }
}

/**
 * Get cache timestamp for debugging/headers
 */
export function getCacheTimestamp(): string | null {
  return cache ? new Date(cache.timestamp).toISOString() : null;
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearCache(): void {
  cache = null;
}
