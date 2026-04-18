// Database types that match our Supabase schema
// These are the "raw" types from the database

export type ArticleStatus = "draft" | "published" | "archived";

export interface DBCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  category_id: string | null;
  author_id: string | null;
  image_url: string | null;
  read_time: string | null;
  status: ArticleStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// Article with joined relations
export interface DBArticleWithRelations extends DBArticle {
  category: DBCategory | null;
  author: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface DBChannel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  subscriber_count: string | null;
  avatar_url: string | null;
  channel_url: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBVideo {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  video_url: string;
  channel_id: string | null;
  views: string | null;
  duration: string | null;
  description: string | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// Video with joined channel
export interface DBVideoWithChannel extends DBVideo {
  channel: DBChannel | null;
}

export interface DBTopic {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category_id: string | null;
  image_url: string | null;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Topic with joined category
export interface DBTopicWithCategory extends DBTopic {
  category: DBCategory | null;
}

// Input types for creating/updating records
export interface CreateArticleInput {
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  category_id?: string;
  image_url?: string;
  read_time?: string;
  status?: ArticleStatus;
}

export interface UpdateArticleInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  category_id?: string | null;
  image_url?: string | null;
  read_time?: string | null;
  status?: ArticleStatus;
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface CreateChannelInput {
  name: string;
  slug: string;
  description?: string;
  subscriber_count?: string;
  avatar_url?: string;
  channel_url?: string;
  is_featured?: boolean;
}

export interface UpdateChannelInput {
  name?: string;
  slug?: string;
  description?: string | null;
  subscriber_count?: string | null;
  avatar_url?: string | null;
  channel_url?: string | null;
  is_featured?: boolean;
}

export interface CreateVideoInput {
  title: string;
  slug: string;
  video_url: string;
  thumbnail_url?: string;
  channel_id?: string;
  views?: string;
  duration?: string;
  description?: string;
  is_featured?: boolean;
  published_at?: string;
}

export interface UpdateVideoInput {
  title?: string;
  slug?: string;
  video_url?: string;
  thumbnail_url?: string | null;
  channel_id?: string | null;
  views?: string | null;
  duration?: string | null;
  description?: string | null;
  is_featured?: boolean;
  published_at?: string | null;
}

export interface CreateTopicInput {
  title: string;
  slug: string;
  excerpt: string;
  category_id?: string;
  image_url?: string;
  is_featured?: boolean;
  display_order?: number;
}

export interface UpdateTopicInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  category_id?: string | null;
  image_url?: string | null;
  is_featured?: boolean;
  display_order?: number;
}

// ============================================================================
// RSS INGESTION TYPES
// ============================================================================

export type RSSContentType = "article" | "video" | "topic";

export interface DBRSSSource {
  id: string;
  name: string;
  slug: string;
  feed_url: string;
  website_url: string | null;
  image_url: string | null;
  description: string | null;
  content_type: RSSContentType;
  youtube_channel_id: string | null;
  is_youtube_feed: boolean;
  is_active: boolean;
  is_featured: boolean;
  last_fetched_at: string | null;
  last_fetch_error: string | null;
  fetch_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface DBRSSItem {
  id: string;
  source_id: string;
  guid: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  external_url: string;
  thumbnail_url: string | null;
  author: string | null;
  published_at: string;
  duration: string | null;
  youtube_video_id: string | null;
  youtube_channel_name: string | null;
  view_count: string | null;
  is_featured: boolean;
  hidden_by_admin: boolean;
  ingested_at: string;
  updated_at: string;
}

/** Admin-editable fields for RSS items (title, excerpt, thumbnail, visibility) */
export interface UpdateRSSItemInput {
  title?: string;
  excerpt?: string | null;
  thumbnail_url?: string | null;
  hidden_by_admin?: boolean;
}

// RSS Item with joined source
export interface DBRSSItemWithSource extends DBRSSItem {
  source: DBRSSSource;
}

export interface DBRSSIngestionLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  sources_processed: number;
  sources_failed: number;
  items_ingested: number;
  items_skipped: number;
  items_failed: number;
  status: "running" | "completed" | "failed" | "partial";
  error_message: string | null;
  details: Record<string, unknown> | null;
}

// Input types for RSS operations
export interface CreateRSSSourceInput {
  name: string;
  slug: string;
  feed_url: string;
  website_url?: string;
  image_url?: string;
  description?: string;
  content_type: RSSContentType;
  youtube_channel_id?: string;
  is_youtube_feed?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
}

export interface UpdateRSSSourceInput {
  name?: string;
  slug?: string;
  feed_url?: string;
  website_url?: string | null;
  image_url?: string | null;
  description?: string | null;
  content_type?: RSSContentType;
  youtube_channel_id?: string | null;
  is_youtube_feed?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  last_fetched_at?: string | null;
  last_fetch_error?: string | null;
  fetch_count?: number;
  error_count?: number;
}

export interface CreateRSSItemInput {
  source_id: string;
  guid: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  external_url: string;
  thumbnail_url?: string;
  author?: string;
  published_at: string;
  duration?: string;
  youtube_video_id?: string;
  youtube_channel_name?: string;
  view_count?: string;
  is_featured?: boolean;
}

// Action result types
export interface ActionResult<T> {
  data?: T;
  error?: string;
}
