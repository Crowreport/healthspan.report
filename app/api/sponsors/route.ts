/**
 * GET /api/sponsors — active sponsored homepage placements.
 *
 * Public: sponsored cards are ads, not gated content. Ordered by
 * display_order (NULL last), then most recently created first.
 *
 * Response: { sponsors: DBSponsor[] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { DBSponsor } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sponsors")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Sponsors API] fetch failed:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch sponsors" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sponsors: (data ?? []) as DBSponsor[] });
  } catch (err) {
    console.error("[Sponsors API] unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sponsors" },
      { status: 500 }
    );
  }
}
