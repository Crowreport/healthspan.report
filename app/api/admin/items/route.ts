/**
 * Admin Items API Route
 *
 * POST /api/admin/items — create a curated content item (admin only).
 *
 * Body fields:
 * - source_url   (required) where the content lives; http(s) URL
 * - headline     (required) title shown on cards
 * - teaser       (optional) short summary/description
 * - tag          (optional) topical label, e.g. "Sleep"
 * - featured     (optional) boolean, defaults to false — surfaces in Top News
 * - source_type  (optional) 'curated' | 'feed', defaults to 'curated'
 * - content_type (optional) 'article' | 'video' | 'podcast' | 'topic' | 'research',
 *                defaults to 'article' — controls which page/section lists the item
 *
 * The item is attached to the internal curated source for its content_type
 * (seeded by migration 015), so existing type-filtered queries pick it up.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/rss/rssFetcher";
import type {
  DBRSSItem,
  RSSContentType,
  RSSItemSourceType,
} from "@/types/database";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: RSSContentType[] = [
  "article",
  "video",
  "podcast",
  "topic",
  "research",
];
const SOURCE_TYPES: RSSItemSourceType[] = ["curated", "feed"];

const PAGE_BY_CONTENT_TYPE: Record<RSSContentType, string> = {
  article: "/articles",
  video: "/videos",
  podcast: "/",
  topic: "/topics",
  research: "/research",
};

interface CreateItemBody {
  source_url?: unknown;
  headline?: unknown;
  teaser?: unknown;
  tag?: unknown;
  featured?: unknown;
  source_type?: unknown;
  content_type?: unknown;
}

interface ValidatedItem {
  source_url: string;
  headline: string;
  teaser: string;
  tag: string | null;
  featured: boolean;
  source_type: RSSItemSourceType;
  content_type: RSSContentType;
}

function validate(body: CreateItemBody): {
  item?: ValidatedItem;
  errors: string[];
} {
  const errors: string[] = [];

  const sourceUrl = typeof body.source_url === "string" ? body.source_url.trim() : "";
  if (!sourceUrl) {
    errors.push("source_url is required");
  } else if (sourceUrl.length > 500) {
    errors.push("source_url must be 500 characters or fewer");
  } else {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push("source_url must be an http(s) URL");
      }
    } catch {
      errors.push("source_url must be a valid URL");
    }
  }

  const headline = typeof body.headline === "string" ? body.headline.trim() : "";
  if (!headline) {
    errors.push("headline is required");
  } else if (headline.length > 500) {
    errors.push("headline must be 500 characters or fewer");
  }

  const teaser = typeof body.teaser === "string" ? body.teaser.trim() : "";
  if (body.teaser !== undefined && typeof body.teaser !== "string") {
    errors.push("teaser must be a string");
  }

  let tag: string | null = null;
  if (body.tag !== undefined && body.tag !== null) {
    if (typeof body.tag !== "string") {
      errors.push("tag must be a string");
    } else if (body.tag.trim().length > 100) {
      errors.push("tag must be 100 characters or fewer");
    } else {
      tag = body.tag.trim() || null;
    }
  }

  let featured = false;
  if (body.featured !== undefined) {
    if (typeof body.featured !== "boolean") {
      errors.push("featured must be a boolean");
    } else {
      featured = body.featured;
    }
  }

  let sourceType: RSSItemSourceType = "curated";
  if (body.source_type !== undefined) {
    if (
      typeof body.source_type !== "string" ||
      !SOURCE_TYPES.includes(body.source_type as RSSItemSourceType)
    ) {
      errors.push(`source_type must be one of: ${SOURCE_TYPES.join(", ")}`);
    } else {
      sourceType = body.source_type as RSSItemSourceType;
    }
  }

  let contentType: RSSContentType = "article";
  if (body.content_type !== undefined) {
    if (
      typeof body.content_type !== "string" ||
      !CONTENT_TYPES.includes(body.content_type as RSSContentType)
    ) {
      errors.push(`content_type must be one of: ${CONTENT_TYPES.join(", ")}`);
    } else {
      contentType = body.content_type as RSSContentType;
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    item: {
      source_url: sourceUrl,
      headline,
      teaser,
      tag,
      featured,
      source_type: sourceType,
      content_type: contentType,
    },
    errors: [],
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: CreateItemBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { item, errors } = validate(body);
  if (!item) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Curated pseudo-sources are seeded by migration 015
    const { data: curatedSource, error: sourceError } = await supabase
      .from("rss_sources")
      .select("id")
      .eq("feed_url", `internal://curated/${item.content_type}`)
      .single();

    if (sourceError || !curatedSource) {
      return NextResponse.json(
        {
          error: `Curated source for '${item.content_type}' not found. Run migration 015.`,
        },
        { status: 500 }
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("rss_items")
      .insert({
        source_id: curatedSource.id,
        guid: item.source_url,
        title: item.headline,
        slug: slugify(item.headline),
        excerpt: item.teaser,
        external_url: item.source_url,
        author: user.email ?? "Admin",
        published_at: new Date().toISOString(),
        is_featured: item.featured,
        source_type: item.source_type,
        tag: item.tag,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "An item with this source_url already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    revalidatePath("/");
    revalidatePath(PAGE_BY_CONTENT_TYPE[item.content_type]);

    return NextResponse.json({ item: created as DBRSSItem }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create item" },
      { status: 500 }
    );
  }
}
