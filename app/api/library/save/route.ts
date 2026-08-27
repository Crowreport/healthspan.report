/**
 * POST /api/library/save — save (bookmark) a content item.
 *
 * Body:
 *   { "item_id": "<uuid>", "folder_id": "<uuid>" | null }
 *
 * `folder_id` is optional. Omit it to save the item unfiled (or to leave an
 * already-saved item where it is); pass a folder id to file it there; pass
 * null to move it back to unfiled.
 *
 * Idempotent: saving an already-saved item returns 200 with the existing row
 * rather than a conflict, because "saved" is a desired end state, not a
 * counter. `created` says which happened.
 *
 * Auth: requires a session. Note that proxy.ts only guards /admin and
 * /api/admin, so this route checks for itself; RLS is the backstop.
 */

import { NextRequest, NextResponse } from "next/server";
import { saveItem } from "@/lib/actions/library";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, parseFolderId } from "@/lib/actions/libraryValidation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to save items" },
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

  const folder = parseFolderId(body.folder_id);
  if (!folder.ok) {
    return NextResponse.json({ error: folder.error }, { status: 400 });
  }

  const result = await saveItem(body.item_id, folder.value);

  if (result.error || !result.data) {
    if (result.notFound) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    console.error("[Library API] save failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to save item" },
      { status: 500 }
    );
  }

  // 201 for a new save, 200 when the item was already in the library.
  const created = result.created === true;

  return NextResponse.json(
    { saved: result.data, created },
    { status: created ? 201 : 200 }
  );
}
