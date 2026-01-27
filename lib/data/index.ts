import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type {
  DBArticleWithRelations,
  DBCategory,
  DBChannel,
  DBVideoWithChannel,
  DBTopicWithCategory,
  DBRSSSource,
  DBRSSItemWithSource,
  RSSContentType,
} from "@/types/database";

// ============================================================================
// CACHED DATA FETCHING UTILITIES FOR SERVER COMPONENTS
// ============================================================================
// These functions use React's cache() to deduplicate requests during a single
// server render. They're optimized for use in Server Components and layouts.
//
// Usage in Server Component:
//   const articles = await fetchPublishedArticles({ limit: 10 });
// ============================================================================

// -----------------------------------------------------------------------------
// Articles
// -----------------------------------------------------------------------------

export const fetchPublishedArticles = cache(
  async (options?: {
    categorySlug?: string;
    limit?: number;
    offset?: number;
  }): Promise<DBArticleWithRelations[]> => {
    const supabase = await createClient();

    let query = supabase
      .from("articles")
      .select(
        `
        *,
        category:categories(*),
        author:users(id, username, first_name, last_name)
      `
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (options?.categorySlug) {
      // Need to filter by category slug - use inner join approach
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", options.categorySlug)
        .single();

      if (category) {
        query = query.eq("category_id", category.id);
      }
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
      console.error("Error fetching articles:", error);
      return [];
    }

    return data as DBArticleWithRelations[];
  }
);

export const fetchArticleBySlug = cache(
  async (slug: string): Promise<DBArticleWithRelations | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("articles")
      .select(
        `
        *,
        category:categories(*),
        author:users(id, username, first_name, last_name)
      `
      )
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) {
      console.error("Error fetching article:", error);
      return null;
    }

    return data as DBArticleWithRelations;
  }
);

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

export const fetchCategories = cache(async (): Promise<DBCategory[]> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }

  return data as DBCategory[];
});

export const fetchCategoryBySlug = cache(
  async (slug: string): Promise<DBCategory | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching category:", error);
      return null;
    }

    return data as DBCategory;
  }
);

// -----------------------------------------------------------------------------
// Channels
// -----------------------------------------------------------------------------

export const fetchChannels = cache(
  async (options?: {
    featured?: boolean;
    limit?: number;
  }): Promise<DBChannel[]> => {
    const supabase = await createClient();

    let query = supabase.from("channels").select("*").order("name");

    if (options?.featured !== undefined) {
      query = query.eq("is_featured", options.featured);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching channels:", error);
      return [];
    }

    return data as DBChannel[];
  }
);

export const fetchChannelBySlug = cache(
  async (slug: string): Promise<DBChannel | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching channel:", error);
      return null;
    }

    return data as DBChannel;
  }
);

// -----------------------------------------------------------------------------
// Videos
// -----------------------------------------------------------------------------

export const fetchVideos = cache(
  async (options?: {
    channelId?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<DBVideoWithChannel[]> => {
    const supabase = await createClient();

    let query = supabase
      .from("videos")
      .select(
        `
        *,
        channel:channels(*)
      `
      )
      .order("published_at", { ascending: false, nullsFirst: false });

    if (options?.channelId) {
      query = query.eq("channel_id", options.channelId);
    }

    if (options?.featured !== undefined) {
      query = query.eq("is_featured", options.featured);
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
      console.error("Error fetching videos:", error);
      return [];
    }

    return data as DBVideoWithChannel[];
  }
);

export const fetchVideoBySlug = cache(
  async (slug: string): Promise<DBVideoWithChannel | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("videos")
      .select(
        `
        *,
        channel:channels(*)
      `
      )
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching video:", error);
      return null;
    }

    return data as DBVideoWithChannel;
  }
);

// -----------------------------------------------------------------------------
// Topics
// -----------------------------------------------------------------------------

export const fetchTopics = cache(
  async (options?: {
    featured?: boolean;
    limit?: number;
  }): Promise<DBTopicWithCategory[]> => {
    const supabase = await createClient();

    let query = supabase
      .from("topics")
      .select(
        `
        *,
        category:categories(*)
      `
      )
      .order("display_order")
      .order("created_at", { ascending: false });

    if (options?.featured !== undefined) {
      query = query.eq("is_featured", options.featured);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching topics:", error);
      return [];
    }

    return data as DBTopicWithCategory[];
  }
);

export const fetchTopicBySlug = cache(
  async (slug: string): Promise<DBTopicWithCategory | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("topics")
      .select(
        `
        *,
        category:categories(*)
      `
      )
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("Error fetching topic:", error);
      return null;
    }

    return data as DBTopicWithCategory;
  }
);

// -----------------------------------------------------------------------------
// Homepage Data (Aggregated)
// -----------------------------------------------------------------------------

export const fetchHomepageData = cache(async () => {
  const [articles, topics, videos, channels] = await Promise.all([
    fetchPublishedArticles({ limit: 6 }),
    fetchTopics({ limit: 6 }),
    fetchVideos({ limit: 5 }),
    fetchChannels({ featured: true, limit: 3 }),
  ]);

  return {
    articles,
    topics,
    videos,
    channels,
  };
});

// -----------------------------------------------------------------------------
// RSS Sources and Items
// -----------------------------------------------------------------------------

export const fetchRSSSources = cache(
  async (options?: {
    contentType?: RSSContentType;
    activeOnly?: boolean;
    featuredOnly?: boolean;
  }): Promise<DBRSSSource[]> => {
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
      console.error("Error fetching RSS sources:", error);
      return [];
    }

    return data as DBRSSSource[];
  }
);

export const fetchRSSItems = cache(
  async (options?: {
    contentType?: RSSContentType;
    sourceId?: string;
    limit?: number;
    offset?: number;
    featuredOnly?: boolean;
  }): Promise<DBRSSItemWithSource[]> => {
    const supabase = await createClient();

    // First get source IDs if filtering by content type
    let sourceIds: string[] | null = null;
    
    if (options?.contentType) {
      const { data: sources } = await supabase
        .from("rss_sources")
        .select("id")
        .eq("content_type", options.contentType)
        .eq("is_active", true);
      
      sourceIds = sources?.map((s) => s.id) || [];
      
      if (sourceIds.length === 0) {
        return [];
      }
    }

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
    } else if (sourceIds) {
      query = query.in("source_id", sourceIds);
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
      console.error("Error fetching RSS items:", error);
      return [];
    }

    return data as DBRSSItemWithSource[];
  }
);

export const fetchYouTubeVideos = cache(
  async (limit: number = 10): Promise<DBRSSItemWithSource[]> => {
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
      console.error("Error fetching YouTube videos:", error);
      return [];
    }

    return data as DBRSSItemWithSource[];
  }
);

export const fetchRSSItemsByType = cache(
  async (
    contentType: RSSContentType,
    limit: number = 10
  ): Promise<DBRSSItemWithSource[]> => {
    return fetchRSSItems({ contentType, limit });
  }
);
