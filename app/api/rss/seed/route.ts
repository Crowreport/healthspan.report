/**
 * RSS Source Seeding API Route
 * 
 * This endpoint seeds the database with RSS sources from feeds.json.
 * Call this once during initial setup or when adding new feeds to the config.
 * 
 * Authentication: Requires admin access
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { seedRSSSources } from "@/lib/rss/ingestionService";

export const dynamic = "force-dynamic";

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

  // For development, allow without auth
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

/**
 * POST /api/rss/seed
 * Seed RSS sources from feeds.json
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("[Seed API] Seeding RSS sources...");

    const result = await seedRSSSources();

    console.log("[Seed API] Complete:", result);

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[Seed API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Seeding failed",
      },
      { status: 500 }
    );
  }
}
