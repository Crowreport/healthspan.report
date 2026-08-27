"use server";

/**
 * Library: saved items + folders (migration 018).
 *
 * Everything here is private to the calling user. Two layers enforce that:
 *
 *   1. Every function resolves the caller with getCurrentUser() and scopes its
 *      query to that id, returning "Not authenticated" when there is no session.
 *   2. RLS on public.saved_items and public.folders restricts every operation
 *      to rows where user_id = auth.uid(), and additionally requires that any
 *      folder_id being written belongs to the caller.
 *
 * The second layer is the real guarantee: even if a handler forgot to scope a
 * query, the database would not return another user's rows.
 */

import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type {
  ActionResult,
  DBFolder,
  DBSavedItem,
  FolderWithCount,
  ListSavedItemsOptions,
  SavedItemWithItem,
} from "@/types/database";
// Constants and pure helpers live in a plain module: a "use server" file may
// only export async functions, so exporting them from here would be a build
// error.
import {
  FOLDER_NAME_MAX_LENGTH,
  FOREIGN_KEY_VIOLATION,
  MAX_FOLDERS_PER_USER,
  SAVED_ITEMS_DEFAULT_LIMIT,
  SAVED_ITEMS_MAX_LIMIT,
  UNIQUE_VIOLATION,
} from "./libraryValidation";


// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/**
 * Create a folder for the current user.
 *
 * Names are trimmed and must be unique per user, case-insensitively — "Sleep"
 * and "sleep" would be indistinguishable in a folder list, so the unique index
 * treats them as one name and this returns a conflict rather than a duplicate.
 */
export async function createFolder(
  name: string
): Promise<ActionResult<DBFolder> & { conflict?: boolean }> {
  const trimmed = typeof name === "string" ? name.trim() : "";

  if (!trimmed) {
    return { error: "Folder name is required" };
  }
  if (trimmed.length > FOLDER_NAME_MAX_LENGTH) {
    return {
      error: `Folder name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer`,
    };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    // Cap folder count. Checked before insert rather than by a constraint,
    // since the limit is a product decision, not a data-integrity rule.
    const { count, error: countError } = await supabase
      .from("folders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      return { error: countError.message };
    }
    if ((count ?? 0) >= MAX_FOLDERS_PER_USER) {
      return { error: `Folder limit reached (${MAX_FOLDERS_PER_USER})` };
    }

    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: user.id, name: trimmed })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { error: `A folder named "${trimmed}" already exists`, conflict: true };
      }
      return { error: error.message };
    }

    return { data: data as DBFolder };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create folder",
    };
  }
}

/**
 * List the current user's folders, newest first, each with the number of saved
 * items filed in it.
 *
 * The count comes from a single grouped read of the user's saved_items rather
 * than a per-folder query, so listing N folders stays two round trips instead
 * of N + 1.
 */
export async function getFolders(): Promise<ActionResult<FolderWithCount[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data: folders, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    const { data: filed, error: countError } = await supabase
      .from("saved_items")
      .select("folder_id")
      .eq("user_id", user.id)
      .not("folder_id", "is", null);

    if (countError) {
      return { error: countError.message };
    }

    const counts = new Map<string, number>();
    for (const row of filed ?? []) {
      const key = (row as { folder_id: string }).folder_id;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return {
      data: ((folders ?? []) as DBFolder[]).map((folder) => ({
        ...folder,
        item_count: counts.get(folder.id) ?? 0,
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch folders",
    };
  }
}

/**
 * Delete one of the current user's folders.
 *
 * Items filed inside it are not deleted: saved_items.folder_id is
 * ON DELETE SET NULL, so they return to unfiled.
 */
export async function deleteFolder(
  folderId: string
): Promise<ActionResult<void> & { notFound?: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      return { error: error.message };
    }
    if (!data || data.length === 0) {
      return { error: "Folder not found", notFound: true };
    }

    return { data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete folder",
    };
  }
}

// ---------------------------------------------------------------------------
// Saved items
// ---------------------------------------------------------------------------

/**
 * Save an item for the current user, optionally filed into a folder.
 *
 * Idempotent: saving an already-saved item succeeds and returns the existing
 * row rather than erroring, because "save" from a UI is a desired end state,
 * not an increment. When a folder is supplied for an already-saved item, the
 * row is moved into that folder.
 */
export async function saveItem(
  itemId: string,
  folderId?: string | null
): Promise<ActionResult<DBSavedItem> & { created?: boolean; notFound?: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    // Verify folder ownership up front so a bad folder returns a clear error
    // rather than surfacing as an RLS policy violation.
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id")
        .eq("id", folderId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (folderError) {
        return { error: folderError.message };
      }
      if (!folder) {
        return { error: "Folder not found", notFound: true };
      }
    }

    // Was it already saved? Checked explicitly rather than inferred from
    // timestamps: the BEFORE UPDATE trigger bumps updated_at even when the
    // upsert changes nothing, so created_at === updated_at is not a reliable
    // signal for "newly created".
    const { data: existing, error: existingError } = await supabase
      .from("saved_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .maybeSingle();

    if (existingError) {
      return { error: existingError.message };
    }

    // Upsert on (user_id, item_id): re-saving is a no-op that returns the
    // existing row, and passing a folder moves it. Omitting folder_id on a
    // re-save deliberately leaves the item where it already is.
    const { data, error } = await supabase
      .from("saved_items")
      .upsert(
        {
          user_id: user.id,
          item_id: itemId,
          ...(folderId !== undefined ? { folder_id: folderId } : {}),
        },
        { onConflict: "user_id,item_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      // item_id doesn't reference a real content item.
      if (error.code === FOREIGN_KEY_VIOLATION) {
        return { error: "Item not found", notFound: true };
      }
      return { error: error.message };
    }

    return { data: data as DBSavedItem, created: !existing };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save item",
    };
  }
}

/**
 * Remove an item from the current user's saved list.
 *
 * `removed` distinguishes "there was a row and it is gone" from "there was
 * nothing saved", so the caller can report an accurate result without a
 * separate existence check. Unsaving something not saved is not an error.
 */
export async function unsaveItem(
  itemId: string
): Promise<ActionResult<{ removed: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("saved_items")
      .delete()
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .select("id");

    if (error) {
      return { error: error.message };
    }

    return { data: { removed: (data?.length ?? 0) > 0 } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to unsave item",
    };
  }
}

/**
 * List the current user's saved items, newest first, joined to the content they
 * point at.
 *
 * `folderId` narrows the list: a folder id returns that folder's contents,
 * `null` returns unfiled items only, and omitting it returns everything.
 */
export async function getSavedItems(
  options: ListSavedItemsOptions = {}
): Promise<ActionResult<{ items: SavedItemWithItem[]; total: number }>> {
  const limit = Math.min(
    Math.max(options.limit ?? SAVED_ITEMS_DEFAULT_LIMIT, 1),
    SAVED_ITEMS_MAX_LIMIT
  );
  const offset = Math.max(options.offset ?? 0, 0);

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    let query = supabase
      .from("saved_items")
      .select("*, item:rss_items(*, source:rss_sources(*))", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // `folderId: null` is a meaningful filter (unfiled only) and must be
    // distinguished from an absent key (no filter at all).
    if (options.folderId !== undefined) {
      query = options.folderId === null
        ? query.is("folder_id", null)
        : query.eq("folder_id", options.folderId);
    }

    const { data, count, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return {
      data: {
        items: (data ?? []) as unknown as SavedItemWithItem[],
        total: count ?? 0,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch saved items",
    };
  }
}

/**
 * Move a saved item into a folder, or out of all folders when `folderId` is
 * null (back to unfiled).
 *
 * Identified by item_id rather than the saved row's id: a client rendering an
 * item knows the content id, and (user_id, item_id) is unique anyway.
 */
export async function moveSavedItemToFolder(
  itemId: string,
  folderId: string | null
): Promise<ActionResult<DBSavedItem> & { notFound?: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    // Confirm the destination folder is the caller's before writing, so a
    // foreign folder reads as "not found" rather than an RLS error.
    if (folderId !== null) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id")
        .eq("id", folderId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (folderError) {
        return { error: folderError.message };
      }
      if (!folder) {
        return { error: "Folder not found", notFound: true };
      }
    }

    const { data, error } = await supabase
      .from("saved_items")
      .update({ folder_id: folderId })
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .select()
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }
    if (!data) {
      return { error: "Saved item not found", notFound: true };
    }

    return { data: data as DBSavedItem };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to move saved item",
    };
  }
}

/**
 * Which of the given items the current user has saved.
 *
 * Batched so a list page can hydrate every save button in one query instead of
 * one per card. Returns an empty set for anonymous callers.
 */
export async function getSavedItemIds(
  itemIds: string[]
): Promise<ActionResult<string[]>> {
  if (itemIds.length === 0) {
    return { data: [] };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { data: [] };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("saved_items")
      .select("item_id")
      .eq("user_id", user.id)
      .in("item_id", itemIds);

    if (error) {
      return { error: error.message };
    }

    return { data: (data ?? []).map((row) => (row as { item_id: string }).item_id) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch saved state",
    };
  }
}
