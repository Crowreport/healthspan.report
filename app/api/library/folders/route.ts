/**
 * GET    /api/library/folders — list the caller's folders.
 * POST   /api/library/folders — create a folder.
 * DELETE /api/library/folders — delete a folder.
 *
 * Folders are private: there is no public-read policy on the table, so RLS
 * alone would prevent one user reading another's collections even if a handler
 * forgot to scope its query.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createFolder,
  deleteFolder,
  getFolders,
} from "@/lib/actions/library";
import { getCurrentUser } from "@/lib/auth";
import { FOLDER_NAME_MAX_LENGTH, isUuid } from "@/lib/actions/libraryValidation";

export const dynamic = "force-dynamic";

/**
 * GET /api/library/folders
 *
 * Response: { folders: [{ id, user_id, name, created_at, updated_at,
 *                         item_count }], total }
 *
 * `item_count` is how many of the caller's saved items are filed in each
 * folder, so a folder list renders without a follow-up request per folder.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view folders" },
      { status: 401 }
    );
  }

  const result = await getFolders();

  if (result.error || !result.data) {
    console.error("[Library API] list folders failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to fetch folders" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    folders: result.data,
    total: result.data.length,
  });
}

/**
 * POST /api/library/folders
 *
 * Body: { "name": "Sleep" }
 *
 * Names are trimmed and unique per user, case-insensitively — a list showing
 * both "Sleep" and "sleep" would be confusing, so the second attempt is a 409.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to create folders" },
      { status: 401 }
    );
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string") {
    return NextResponse.json(
      { error: "name is required and must be a string" },
      { status: 400 }
    );
  }
  if (!body.name.trim()) {
    return NextResponse.json({ error: "name cannot be blank" }, { status: 400 });
  }
  if (body.name.trim().length > FOLDER_NAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const result = await createFolder(body.name);

  if (result.error || !result.data) {
    if (result.conflict) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    console.error("[Library API] create folder failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to create folder" },
      { status: 500 }
    );
  }

  return NextResponse.json({ folder: result.data }, { status: 201 });
}

/**
 * DELETE /api/library/folders?id=<uuid>
 *
 * Items filed in the folder are kept — saved_items.folder_id is
 * ON DELETE SET NULL, so they return to unfiled rather than being destroyed
 * along with the folder.
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to delete folders" },
      { status: 401 }
    );
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "id query parameter is required and must be a UUID" },
      { status: 400 }
    );
  }

  const result = await deleteFolder(id);

  if (result.error) {
    if (result.notFound) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    console.error("[Library API] delete folder failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, id });
}
