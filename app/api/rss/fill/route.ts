/**
 * One-shot: seed RSS sources from feeds.json, then run ingestion to fill rss_items.
 * Call once to populate the DB. Cron will keep it updated every 3 hours via /api/rss/ingest.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { seedRSSSources, runIngestion } from "@/lib/rss/ingestionService";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headersList = await headers();
    if (headersList.get("authorization") === `Bearer ${cronSecret}`) return true;
  }
  if ((await headers()).get("x-vercel-cron") === "true") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const seedResult = await seedRSSSources();
    const ingestResult = await runIngestion();

    return NextResponse.json({
      success: ingestResult.status !== "failed",
      seed: { created: seedResult.created, skipped: seedResult.skipped, errors: seedResult.errors },
      ingest: {
        status: ingestResult.status,
        itemsIngested: ingestResult.totalItemsIngested,
        itemsSkipped: ingestResult.totalItemsSkipped,
        durationMs: ingestResult.durationMs,
      },
    });
  } catch (error) {
    console.error("[Fill API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fill failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
