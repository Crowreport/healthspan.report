/**
 * RSS Items API Route
 * 
 * Serves persisted RSS content from the database.
 * This endpoint returns normalized, deduplicated content that was
 * ingested via the periodic polling system.
 * 
 * Query Parameters:
 * - type: Filter by content type (article, video, topic)
 * - limit: Maximum items to return (default: 20)
 * - offset: Pagination offset
 * - featured: Only return featured items (true/false)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { RSSContentType } from "@/types/database";
import type { RSSSource, RSSArticle } from "@/types/rss";

export const dynamic = "force-dynamic";

interface DBItemWithSource {
  id: string;
  guid: string;
  title: string;
  slug: string;
  excerpt: string | null;
  external_url: string;
  thumbnail_url: string | null;
  author: string | null;
  published_at: string;
  duration: string | null;
  youtube_video_id: string | null;
  youtube_channel_name: string | null;
  view_count: string | null;
  is_featured: boolean;
  source: {
    id: string;
    name: string;
    slug: string;
    feed_url: string;
    website_url: string | null;
    image_url: string | null;
    content_type: RSSContentType;
    is_youtube_feed: boolean;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type") as RSSContentType | null;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const featuredOnly = searchParams.get("featured") === "true";

  try {
    const supabase = await createClient();

    // First get sources of the requested type
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
      return NextResponse.json({
        sources: [],
        total: 0,
        fromDatabase: true,
      });
    }

    // Get items from those sources
    let itemsQuery = supabase
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
        duration,
        youtube_video_id,
        youtube_channel_name,
        view_count,
        is_featured,
        source:rss_sources(
          id,
          name,
          slug,
          feed_url,
          website_url,
          image_url,
          content_type,
          is_youtube_feed
        )
      `,
        { count: "exact" }
      )
      .in("source_id", sourceIds)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (featuredOnly) {
      itemsQuery = itemsQuery.eq("is_featured", true);
    }

    const { data: items, count, error } = await itemsQuery;

    if (error) {
      console.error("[RSS Items API] Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Group items by source for backward compatibility with existing components
    const sourceMap = new Map<string, RSSSource>();

    for (const item of items || []) {
      // Supabase returns nested relations as objects, but TypeScript may see it differently
      const source = (item.source as unknown) as DBItemWithSource["source"] | null;
      if (!source) continue;

      const sourceKey = source.id;

      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, {
          source: {
            title: source.name,
            link: source.website_url || "",
            feedUrl: source.feed_url,
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

    return NextResponse.json({
      sources: Array.from(sourceMap.values()),
      total: count || 0,
      fromDatabase: true,
    });
  } catch (error) {
    console.error("[RSS Items API] Error:", error);

    return NextResponse.json(
      {
        sources: [],
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
