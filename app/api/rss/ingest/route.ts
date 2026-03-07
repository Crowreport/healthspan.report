/**
 * RSS Ingestion API Route
 * 
 * This endpoint triggers the RSS content ingestion process.
 * It's designed to be called by:
 * - Cron jobs (e.g., Vercel Cron, external cron services)
 * - Manual triggers from admin panel
 * - Webhooks
 * 
 * Authentication:
 * - Requires CRON_SECRET header for automated calls
 * - Or authenticated admin user session
 * 
 * Usage with Vercel Cron:
 * Add to vercel.json with crons array containing path and schedule
 * Schedule example: "0 *\/2 * * *" runs every 2 hours
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { runIngestion } from "@/lib/rss/ingestionService";
import type { IngestionOptions } from "@/types/rss";

// Mark as dynamic to prevent caching
export const dynamic = "force-dynamic";

// Maximum duration for the function (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 10;

/**
 * Verify the request is authorized
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Check for cron secret (for automated calls)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) {
      return true;
    }
  }

  // Check for Vercel Cron header
  const headersList = await headers();
  const vercelCron = headersList.get("x-vercel-cron");
  if (vercelCron === "true" || vercelCron === "1") {
    return true;
  }

  // For development, allow without auth
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

/**
 * POST /api/rss/ingest
 * Trigger RSS ingestion
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Parse options from request body
    let options: IngestionOptions = {};
    
    try {
      const body = await request.json();
      options = {
        sourceIds: body.sourceIds,
        contentTypes: body.contentTypes,
        force: body.force,
        maxItemsPerSource: body.maxItemsPerSource,
        timeoutMs: body.timeoutMs,
      };
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log("[Ingest API] Starting ingestion...", options);

    const result = await runIngestion(options);

    console.log("[Ingest API] Complete:", {
      status: result.status,
      ingested: result.totalItemsIngested,
      skipped: result.totalItemsSkipped,
      duration: result.durationMs,
    });

    return NextResponse.json({
      success: result.status !== "failed",
      result,
    });
  } catch (error) {
    console.error("[Ingest API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ingestion failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rss/ingest
 * Also supports GET for simple cron triggers
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("[Ingest API] Starting ingestion (GET trigger)...");

    const result = await runIngestion();

    console.log("[Ingest API] Complete:", {
      status: result.status,
      ingested: result.totalItemsIngested,
      skipped: result.totalItemsSkipped,
      duration: result.durationMs,
    });

    return NextResponse.json({
      success: result.status !== "failed",
      result,
    });
  } catch (error) {
    console.error("[Ingest API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ingestion failed",
      },
      { status: 500 }
    );
  }
}
