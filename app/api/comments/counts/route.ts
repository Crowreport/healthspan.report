/**
 * Comment Counts API Route
 *
 * GET /api/comments/counts?ids=uuid1,uuid2,... — bulk comment counts per
 * rss_item, used to populate the comment bubble on homepage cards without a
 * per-card round trip.
 *
 * Response: { counts: { [rssItemId: string]: number } }
 * IDs that aren't valid UUIDs (e.g. mock/fallback card ids) are silently
 * dropped rather than erroring — the client treats a missing key as 0.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MAX_IDS = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ counts: {} });
  }

  const ids = Array.from(
    new Set(
      idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id))
    )
  ).slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ counts: {} });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("comments")
      .select("rss_item_id")
      .in("rss_item_id", ids);

    if (error) {
      console.error("[Comment Counts API] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.rss_item_id] = (counts[row.rss_item_id] ?? 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("[Comment Counts API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch comment counts" },
      { status: 500 }
    );
  }
}
