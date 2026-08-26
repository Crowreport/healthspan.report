/**
 * POST /api/library/unsave — remove an item from the caller's saved list.
 *
 * Body: { "item_id": "<uuid>" }
 *
 * Idempotent: unsaving something that was not saved returns 200 with
 * `removed: false` rather than 404. The end state the caller asked for — "this
 * item is not in my library" — holds either way, and a UI toggling a save
 * button off should not have to care which it was.
 *
 * Auth: requires a session; RLS additionally scopes the delete to the caller,
 * so one user cannot unsave another's item.
 */

import { NextRequest, NextResponse } from "next/server";
import { unsaveItem } from "@/lib/actions/library";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions/libraryValidation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to manage saved items" },
      { status: 401 }
    );
  }

  let body: { item_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isUuid(body.item_id)) {
    return NextResponse.json(
      { error: "item_id is required and must be a UUID" },
      { status: 400 }
    );
  }

  const result = await unsaveItem(body.item_id);

  if (result.error || !result.data) {
    console.error("[Library API] unsave failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to unsave item" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    item_id: body.item_id,
    removed: result.data.removed,
  });
}
