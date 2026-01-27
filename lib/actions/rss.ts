"use server";

import { createClient } from "@/utils/supabase/server";
import type {
  DBRSSSource,
  DBRSSItem,
  DBRSSItemWithSource,
  DBRSSIngestionLog,
  CreateRSSSourceInput,
  UpdateRSSSourceInput,
  ActionResult,
  RSSContentType,
} from "@/types/database";

// ============================================================================
// RSS SOURCE OPERATIONS
// ============================================================================

/**
 * Get all RSS sources
 */
export async function getRSSSources(options?: {
  contentType?: RSSContentType;
  activeOnly?: boolean;
  featuredOnly?: boolean;
}): Promise<ActionResult<DBRSSSource[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("rss_sources")
      .select("*")
      .order("name", { ascending: true });

    if (options?.contentType) {
      query = query.eq("content_type", options.contentType);
    }

    if (options?.activeOnly !== false) {
      query = query.eq("is_active", true);
    }

    if (options?.featuredOnly) {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSSource[] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch RSS sources",
    };
  }
}

/**
 * Get a single RSS source by ID
 */
export async function getRSSSourceById(
  id: string
): Promise<ActionResult<DBRSSSource>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_sources")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSSource };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch RSS source",
    };
  }
}

/**
 * Create a new RSS source
 */
export async function createRSSSource(
  input: CreateRSSSourceInput
): Promise<ActionResult<DBRSSSource>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_sources")
      .insert(input)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSSource };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create RSS source",
    };
  }
}

/**
 * Update an RSS source
 */
export async function updateRSSSource(
  id: string,
  input: UpdateRSSSourceInput
): Promise<ActionResult<DBRSSSource>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_sources")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSSource };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update RSS source",
    };
  }
}

/**
 * Delete an RSS source
 */
export async function deleteRSSSource(
  id: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("rss_sources")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    return { data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete RSS source",
    };
  }
}

// ============================================================================
// RSS ITEM OPERATIONS
// ============================================================================

/**
 * Get RSS items with optional filtering
 */
export async function getRSSItems(options?: {
  contentType?: RSSContentType;
  sourceId?: string;
  limit?: number;
  offset?: number;
  featuredOnly?: boolean;
}): Promise<ActionResult<DBRSSItemWithSource[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("rss_items")
      .select(
        `
        *,
        source:rss_sources(*)
      `
      )
      .order("published_at", { ascending: false });

    if (options?.sourceId) {
      query = query.eq("source_id", options.sourceId);
    }

    if (options?.contentType) {
      query = query.eq("source.content_type", options.contentType);
    }

    if (options?.featuredOnly) {
      query = query.eq("is_featured", true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    // Filter out items where source is null (due to content_type filter on joined table)
    const filteredData = options?.contentType
      ? (data as DBRSSItemWithSource[]).filter((item) => item.source !== null)
      : (data as DBRSSItemWithSource[]);

    return { data: filteredData };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch RSS items",
    };
  }
}

/**
 * Get RSS items by content type with source info
 */
export async function getRSSItemsByType(
  contentType: RSSContentType,
  limit: number = 10
): Promise<ActionResult<DBRSSItemWithSource[]>> {
  try {
    const supabase = await createClient();

    // First get source IDs of the specified content type
    const { data: sources, error: sourcesError } = await supabase
      .from("rss_sources")
      .select("id")
      .eq("content_type", contentType)
      .eq("is_active", true);

    if (sourcesError) {
      return { error: sourcesError.message };
    }

    if (!sources || sources.length === 0) {
      return { data: [] };
    }

    const sourceIds = sources.map((s) => s.id);

    // Then get items from those sources
    const { data, error } = await supabase
      .from("rss_items")
      .select(
        `
        *,
        source:rss_sources(*)
      `
      )
      .in("source_id", sourceIds)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSItemWithSource[] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch RSS items",
    };
  }
}

/**
 * Get a single RSS item by ID
 */
export async function getRSSItemById(
  id: string
): Promise<ActionResult<DBRSSItemWithSource>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_items")
      .select(
        `
        *,
        source:rss_sources(*)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSItemWithSource };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch RSS item",
    };
  }
}

/**
 * Get YouTube videos from RSS items
 */
export async function getYouTubeVideos(
  limit: number = 10
): Promise<ActionResult<DBRSSItemWithSource[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_items")
      .select(
        `
        *,
        source:rss_sources(*)
      `
      )
      .not("youtube_video_id", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSItemWithSource[] };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch YouTube videos",
    };
  }
}

/**
 * Toggle featured status of an RSS item
 */
export async function toggleRSSItemFeatured(
  id: string,
  featured: boolean
): Promise<ActionResult<DBRSSItem>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_items")
      .update({ is_featured: featured })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSItem };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to update RSS item featured status",
    };
  }
}

// ============================================================================
// INGESTION LOG OPERATIONS
// ============================================================================

/**
 * Get recent ingestion logs
 */
export async function getIngestionLogs(
  limit: number = 20
): Promise<ActionResult<DBRSSIngestionLog[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_ingestion_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSIngestionLog[] };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch ingestion logs",
    };
  }
}

/**
 * Get the last successful ingestion
 */
export async function getLastSuccessfulIngestion(): Promise<
  ActionResult<DBRSSIngestionLog | null>
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rss_ingestion_log")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBRSSIngestionLog | null };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch last ingestion",
    };
  }
}
