/**
 * RSS Ingestion Status API Route
 * 
 * Returns current status of the RSS ingestion system including:
 * - Last successful ingestion
 * - Source statistics
 * - Recent ingestion logs
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get source counts by content type
    const { data: sources } = await supabase
      .from("rss_sources")
      .select("content_type, is_active, is_youtube_feed")
      .eq("is_active", true);

    const sourceStats = {
      total: sources?.length || 0,
      articles: sources?.filter((s) => s.content_type === "article").length || 0,
      videos: sources?.filter((s) => s.content_type === "video").length || 0,
      topics: sources?.filter((s) => s.content_type === "topic").length || 0,
      youtube: sources?.filter((s) => s.is_youtube_feed).length || 0,
    };

    // Get item counts by content type
    const { count: totalItems } = await supabase
      .from("rss_items")
      .select("id", { count: "exact", head: true });

    // Get last successful ingestion
    const { data: lastIngestion } = await supabase
      .from("rss_ingestion_log")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get recent ingestion logs
    const { data: recentLogs } = await supabase
      .from("rss_ingestion_log")
      .select("id, started_at, completed_at, status, items_ingested, items_skipped, sources_failed")
      .order("started_at", { ascending: false })
      .limit(5);

    // Get sources with errors
    const { data: errorSources } = await supabase
      .from("rss_sources")
      .select("id, name, last_fetch_error, error_count")
      .not("last_fetch_error", "is", null)
      .order("error_count", { ascending: false })
      .limit(5);

    return NextResponse.json({
      sources: sourceStats,
      items: {
        total: totalItems || 0,
      },
      lastIngestion: lastIngestion
        ? {
            id: lastIngestion.id,
            completedAt: lastIngestion.completed_at,
            durationMs: lastIngestion.duration_ms,
            itemsIngested: lastIngestion.items_ingested,
            itemsSkipped: lastIngestion.items_skipped,
          }
        : null,
      recentLogs: recentLogs || [],
      errorSources: errorSources || [],
    });
  } catch (error) {
    console.error("[Status API] Error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}
