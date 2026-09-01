"use server";

/**
 * Reading history (migration 019).
 *
 * Private to the calling user, enforced in the same two layers as the rest of
 * the library:
 *
 *   1. Every function resolves the caller with getCurrentUser() and scopes its
 *      query to that id.
 *   2. RLS on public.reading_history restricts every operation to rows where
 *      user_id = auth.uid().
 *
 * The debounce lives here rather than in the route handler so that any caller —
 * a route, a server component, a future server action — gets the same
 * anti-spam behaviour without having to remember it.
 */

import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type {
  ActionResult,
  DBReadingHistoryEntry,
  DBReadingHistoryEntryWithItem,
  ListReadingHistoryOptions,
  RecordViewResult,
} from "@/types/database";
import {
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  FOREIGN_KEY_VIOLATION,
  VIEW_DEBOUNCE_MS,
} from "./libraryValidation";

/**
 * Record that the current user opened an item.
 *
 * Debounced: if the same user viewed the same item within VIEW_DEBOUNCE_MS,
 * the existing row is returned untouched and `recorded` is false. This is what
 * stops a re-render, a back-button, or a refresh loop from inflating
 * view_count and churning viewed_at.
 *
 * Anonymous callers are a no-op success, not an error: there is no history to
 * write for a visitor without an account, and a tracking beacon firing on a
 * public page should not surface as a failure.
 */
export async function recordItemView(
  itemId: string
): Promise<ActionResult<RecordViewResult | null> & { notFound?: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      // Nothing to record, and nothing went wrong.
      return { data: null };
    }

    const supabase = await createClient();

    // Read the current row first. Two reasons this is a separate query rather
    // than a single clever upsert: the debounce decision needs the stored
    // viewed_at, and view_count must be incremented from its existing value
    // (PostgREST cannot express `view_count = view_count + 1` in an upsert
    // payload).
    const { data: existing, error: existingError } = await supabase
      .from("reading_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .maybeSingle();

    if (existingError) {
      return { error: existingError.message };
    }

    const now = Date.now();

    if (existing) {
      const entry = existing as DBReadingHistoryEntry;
      const lastViewed = new Date(entry.viewed_at).getTime();

      // Within the debounce window: leave the row exactly as it is. An
      // unparseable stored timestamp (NaN) falls through to the write path,
      // which is the safe direction — a missed debounce costs one extra
      // update, whereas treating NaN as "recent" would silently stop
      // recording views for that row forever.
      if (Number.isFinite(lastViewed) && now - lastViewed < VIEW_DEBOUNCE_MS) {
        return { data: { entry, recorded: false, created: false } };
      }

      const { data, error } = await supabase
        .from("reading_history")
        .update({
          viewed_at: new Date(now).toISOString(),
          view_count: entry.view_count + 1,
        })
        .eq("user_id", user.id)
        .eq("item_id", itemId)
        .select()
        .single();

      if (error) {
        return { error: error.message };
      }

      return {
        data: {
          entry: data as DBReadingHistoryEntry,
          recorded: true,
          created: false,
        },
      };
    }

    // First view of this item. Upsert rather than insert to absorb the race
    // where two tabs open the same item at once: the loser of the insert race
    // would otherwise hit the unique index and 500.
    const { data, error } = await supabase
      .from("reading_history")
      .upsert(
        {
          user_id: user.id,
          item_id: itemId,
          viewed_at: new Date(now).toISOString(),
          view_count: 1,
        },
        { onConflict: "user_id,item_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) {
        return { error: "Item not found", notFound: true };
      }
      return { error: error.message };
    }

    return {
      data: {
        entry: data as DBReadingHistoryEntry,
        recorded: true,
        created: true,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to record view",
    };
  }
}

/**
 * List the current user's reading history, most recently viewed first, joined
 * to the content each entry points at.
 *
 * No deduplication needed: the table holds one row per (user, item) by
 * construction, so "recent reads" is a plain ordered read.
 */
export async function getReadingHistory(
  options: ListReadingHistoryOptions = {}
): Promise<
  ActionResult<{ entries: DBReadingHistoryEntryWithItem[]; total: number }>
> {
  const limit = Math.min(
    Math.max(options.limit ?? HISTORY_DEFAULT_LIMIT, 1),
    HISTORY_MAX_LIMIT
  );
  const offset = Math.max(options.offset ?? 0, 0);

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data, count, error } = await supabase
      .from("reading_history")
      .select("*, item:rss_items(*, source:rss_sources(*))", { count: "exact" })
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { error: error.message };
    }

    return {
      data: {
        entries: (data ?? []) as unknown as DBReadingHistoryEntryWithItem[],
        total: count ?? 0,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch history",
    };
  }
}

/**
 * Remove a single item from the current user's history.
 *
 * `removed` distinguishes "there was an entry and it is gone" from "there was
 * nothing to forget", mirroring unsaveItem. Forgetting something never read is
 * not an error.
 */
export async function deleteHistoryEntry(
  itemId: string
): Promise<ActionResult<{ removed: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reading_history")
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
      error: err instanceof Error ? err.message : "Failed to delete entry",
    };
  }
}

/**
 * Clear the current user's entire reading history.
 *
 * Returns how many entries were removed. Separate from deleteHistoryEntry
 * because "forget everything" is a distinct, deliberate user action and should
 * not be reachable by accidentally omitting an item id.
 */
export async function clearReadingHistory(): Promise<
  ActionResult<{ removed: number }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reading_history")
      .delete()
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      return { error: error.message };
    }

    return { data: { removed: data?.length ?? 0 } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to clear history",
    };
  }
}
