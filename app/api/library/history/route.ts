/**
 * GET    /api/library/history — the caller's recently read items.
 * POST   /api/library/history — record that the caller opened an item.
 * DELETE /api/library/history — forget one item, or clear the whole history.
 *
 * Every response is scoped to the caller, and RLS on public.reading_history
 * enforces the same scoping in the database, so a bug here could not leak
 * another user's reading history.
 *
 * Auth: proxy.ts only guards /admin and /api/admin, so this route checks for
 * itself. The POST is the exception to the usual 401 — see below.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  clearReadingHistory,
  deleteHistoryEntry,
  getReadingHistory,
  recordItemView,
} from "@/lib/actions/readingHistory";
import { getCurrentUser } from "@/lib/auth";
import {
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  isUuid,
} from "@/lib/actions/libraryValidation";

export const dynamic = "force-dynamic";

/**
 * GET /api/library/history?limit=25&offset=0
 *
 * Response: { entries, total, limit, offset }
 *
 * Entries come back most-recently-viewed first, each joined to its item, and
 * are already unique per item — the table holds one row per (user, item), so
 * there is nothing to deduplicate client-side.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view reading history" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

  const rawLimit = searchParams.get("limit");
  let limit = HISTORY_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 }
      );
    }
    limit = Math.min(parsed, HISTORY_MAX_LIMIT);
  }

  const rawOffset = searchParams.get("offset");
  let offset = 0;
  if (rawOffset !== null) {
    const parsed = Number.parseInt(rawOffset, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "offset must be a non-negative integer" },
        { status: 400 }
      );
    }
    offset = parsed;
  }

  const result = await getReadingHistory({ limit, offset });

  if (result.error || !result.data) {
    console.error("[History API] list failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to fetch reading history" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    entries: result.data.entries,
    total: result.data.total,
    limit,
    offset,
  });
}

/**
 * POST /api/library/history
 *
 * Body: { "item_id": "<uuid>" }
 *
 * Called when a user opens an item page. Debounced in recordItemView: a repeat
 * view of the same item inside the debounce window returns 200 with
 * `recorded: false` and leaves the stored row untouched.
 *
 * Deliberately NOT 401 for anonymous callers. This fires from a page that
 * anonymous visitors can read, and there is simply no history to write for a
 * user without an account — a 401 would turn an expected case into console
 * noise and failed requests on every public page view. `tracked: false` says
 * plainly that nothing was recorded.
 */
export async function POST(request: NextRequest) {
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

  const result = await recordItemView(body.item_id);

  if (result.error) {
    if (result.notFound) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    console.error("[History API] record view failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to record view" },
      { status: 500 }
    );
  }

  // data === null means an anonymous caller: valid request, nothing stored.
  if (!result.data) {
    return NextResponse.json({ tracked: false, recorded: false });
  }

  return NextResponse.json({
    tracked: true,
    // false when the debounce window suppressed the write.
    recorded: result.data.recorded,
    created: result.data.created,
    entry: result.data.entry,
  });
}

/**
 * DELETE /api/library/history            — clear the entire history.
 * DELETE /api/library/history?item=<uuid> — forget a single item.
 *
 * Clearing everything requires the absence of `item` rather than a flag like
 * `all=true`, which is the more dangerous default; a client that means to
 * forget one item and sends a malformed id gets a 400, not a wiped history.
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to manage reading history" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawItem = searchParams.get("item");

  if (rawItem !== null) {
    if (!isUuid(rawItem)) {
      return NextResponse.json(
        { error: "item must be a UUID" },
        { status: 400 }
      );
    }

    const result = await deleteHistoryEntry(rawItem);
    if (result.error || !result.data) {
      console.error("[History API] delete entry failed:", result.error);
      return NextResponse.json(
        { error: result.error ?? "Failed to delete history entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ removed: result.data.removed });
  }

  const result = await clearReadingHistory();
  if (result.error || !result.data) {
    console.error("[History API] clear failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to clear reading history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ cleared: true, removed: result.data.removed });
}
