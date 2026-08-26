/**
 * GET   /api/library/saved — list the caller's saved items.
 * PATCH /api/library/saved — move a saved item into (or out of) a folder.
 *
 * Query parameters for GET:
 * - folder:   a folder UUID to list that folder's contents, or the literal
 *             "none" for unfiled items only. Omit for everything.
 * - limit:    page size, default 50, capped at 100.
 * - offset:   pagination offset.
 *
 * Every response is scoped to the caller. RLS enforces this in the database as
 * well, so a bug here could not leak another user's library.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSavedItems,
  moveSavedItemToFolder,
} from "@/lib/actions/library";
import { getCurrentUser } from "@/lib/auth";
import {
  isUuid,
  parseFolderId,
  SAVED_ITEMS_DEFAULT_LIMIT,
  SAVED_ITEMS_MAX_LIMIT,
} from "@/lib/actions/libraryValidation";

export const dynamic = "force-dynamic";

/** Sentinel for "unfiled only" — a query string can't carry a real null. */
const UNFILED = "none";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view saved items" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

  // Distinguish three cases: no filter, unfiled only, and a specific folder.
  const rawFolder = searchParams.get("folder");
  let folderId: string | null | undefined;
  if (rawFolder !== null) {
    if (rawFolder === UNFILED) {
      folderId = null;
    } else if (isUuid(rawFolder)) {
      folderId = rawFolder;
    } else {
      return NextResponse.json(
        { error: `folder must be a UUID or "${UNFILED}"` },
        { status: 400 }
      );
    }
  }

  const rawLimit = searchParams.get("limit");
  let limit = SAVED_ITEMS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 }
      );
    }
    limit = Math.min(parsed, SAVED_ITEMS_MAX_LIMIT);
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

  const result = await getSavedItems({ folderId, limit, offset });

  if (result.error || !result.data) {
    console.error("[Library API] list saved failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to fetch saved items" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: result.data.items,
    total: result.data.total,
    limit,
    offset,
  });
}

/**
 * PATCH /api/library/saved
 *
 * Body: { "item_id": "<uuid>", "folder_id": "<uuid>" | null }
 *
 * This is the "move item into a folder" operation. `folder_id: null` moves it
 * back to unfiled. `folder_id` is required here — unlike POST /save, where
 * omitting it means "leave alone", a move with no destination is meaningless.
 */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to manage saved items" },
      { status: 401 }
    );
  }

  let body: { item_id?: unknown; folder_id?: unknown };
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

  if (body.folder_id === undefined) {
    return NextResponse.json(
      { error: "folder_id is required (use null to unfile)" },
      { status: 400 }
    );
  }

  const folder = parseFolderId(body.folder_id);
  if (!folder.ok) {
    return NextResponse.json({ error: folder.error }, { status: 400 });
  }

  const result = await moveSavedItemToFolder(
    body.item_id,
    (folder.value ?? null) as string | null
  );

  if (result.error || !result.data) {
    if (result.notFound) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    console.error("[Library API] move failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to move saved item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ saved: result.data });
}
