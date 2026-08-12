/**
 * Top News API Route
 *
 * GET /api/top-news — featured items for the homepage Top News block.
 *
 * Query parameters:
 * - limit: total items across hero + list (default 6, max 20)
 * - type:  restrict to one content type (article, video, podcast, topic, research)
 *
 * Response:
 *   {
 *     "hero":  { id, headline, teaser, slug, imageUrl, externalUrl,
 *                publishedAt, sourceName, tags, contentType, rank } | null,
 *     "items": [ ...same shape, rank 2..n ],
 *     "total": <number of featured items considered>
 *   }
 *
 * Only presentation fields are returned — internal columns (guid, source_id,
 * content, hidden_by_admin, …) are never exposed.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getTopNewsItems,
  TOP_NEWS_DEFAULT_LIMIT,
  TOP_NEWS_MAX_LIMIT,
} from "@/lib/content/topNews";
import type { RSSContentType } from "@/types/database";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: RSSContentType[] = [
  "article",
  "video",
  "podcast",
  "topic",
  "research",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawLimit = searchParams.get("limit");
  let limit = TOP_NEWS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 }
      );
    }
    limit = Math.min(parsed, TOP_NEWS_MAX_LIMIT);
  }

  const rawType = searchParams.get("type");
  let contentType: RSSContentType | undefined;
  if (rawType !== null) {
    if (!CONTENT_TYPES.includes(rawType as RSSContentType)) {
      return NextResponse.json(
        { error: `type must be one of: ${CONTENT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    contentType = rawType as RSSContentType;
  }

  const result = await getTopNewsItems({ limit, contentType });

  if (result.error) {
    console.error("[Top News API] Error:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    hero: result.hero,
    items: result.items,
    total: result.total,
  });
}
