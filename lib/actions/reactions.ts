"use server";

/**
 * Reactions on content items (public.item_reactions, migration 016).
 *
 * Cardinality: one row per (item_id, user_id, reaction_type). A user may hold
 * several distinct reaction types on the same item simultaneously — e.g. both
 * 'insightful' and 'favorite' — but never the same type twice. Removing a
 * reaction is a delete, so the UI toggle maps to add/remove rather than update.
 *
 * Writes are additionally gated by RLS: a user can only insert or delete rows
 * where user_id = auth.uid().
 */

import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ITEM_REACTION_TYPES,
  type ActionResult,
  type DBItemReaction,
  type ItemReactionSummary,
  type ItemReactionType,
} from "@/types/database";

function emptyCounts(): Record<ItemReactionType, number> {
  return ITEM_REACTION_TYPES.reduce(
    (acc, type) => ({ ...acc, [type]: 0 }),
    {} as Record<ItemReactionType, number>
  );
}

/**
 * Reaction counts for an item, plus the current user's own reactions
 * (empty for anonymous callers).
 */
export async function getItemReactions(
  itemId: string
): Promise<ActionResult<ItemReactionSummary>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("item_reactions")
      .select("user_id, reaction_type")
      .eq("item_id", itemId);

    if (error) {
      return { error: error.message };
    }

    const user = await getCurrentUser();
    const counts = emptyCounts();
    const userReactions: ItemReactionType[] = [];

    for (const row of data ?? []) {
      const type = row.reaction_type as ItemReactionType;
      if (type in counts) {
        counts[type] += 1;
      }
      if (user && row.user_id === user.id) {
        userReactions.push(type);
      }
    }

    return { data: { item_id: itemId, counts, userReactions } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch reactions",
    };
  }
}

/**
 * Add a reaction for the current user. Idempotent: re-adding a reaction the
 * user already holds is a no-op rather than an error.
 */
export async function addItemReaction(
  itemId: string,
  reactionType: ItemReactionType
): Promise<ActionResult<DBItemReaction>> {
  if (!ITEM_REACTION_TYPES.includes(reactionType)) {
    return { error: `Invalid reaction type: ${reactionType}` };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("item_reactions")
      .upsert(
        {
          item_id: itemId,
          user_id: user.id,
          reaction_type: reactionType,
        },
        { onConflict: "item_id,user_id,reaction_type", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: data as DBItemReaction };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to add reaction",
    };
  }
}

/**
 * Toggle a reaction for the current user: add it if absent, remove it if the
 * user already holds it. This is the action behind a reaction button — one
 * round trip per tap, and the response says which way it went.
 *
 * Distinct from `addItemReaction`, which is deliberately add-only and
 * idempotent: a caller that wants "ensure this reaction exists" must not get a
 * removal when it happens to already be there.
 */
export async function toggleItemReaction(
  itemId: string,
  reactionType: ItemReactionType
): Promise<ActionResult<{ reacted: boolean }>> {
  if (!ITEM_REACTION_TYPES.includes(reactionType)) {
    return { error: `Invalid reaction type: ${reactionType}` };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    // Read-then-write, not an upsert: we need to know the prior state to decide
    // the direction. A concurrent double-tap can interleave here, but the worst
    // case is the reaction landing in the state of whichever request finished
    // last — no duplicate rows, since the primary key forbids them.
    const { data: existing, error: selectError } = await supabase
      .from("item_reactions")
      .select("item_id")
      .eq("item_id", itemId)
      .eq("user_id", user.id)
      .eq("reaction_type", reactionType)
      .maybeSingle();

    if (selectError) {
      return { error: selectError.message };
    }

    if (existing) {
      const { error: deleteError } = await supabase
        .from("item_reactions")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", user.id)
        .eq("reaction_type", reactionType);

      if (deleteError) {
        return { error: deleteError.message };
      }

      return { data: { reacted: false } };
    }

    const { error: insertError } = await supabase
      .from("item_reactions")
      .insert({
        item_id: itemId,
        user_id: user.id,
        reaction_type: reactionType,
      });

    if (insertError) {
      // Lost a race with a concurrent insert of the same reaction — the row now
      // exists, which is the state the caller asked for.
      if (insertError.code === "23505") {
        return { data: { reacted: true } };
      }
      return { error: insertError.message };
    }

    return { data: { reacted: true } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to toggle reaction",
    };
  }
}

/** Remove one of the current user's reactions from an item (the toggle-off path). */
export async function removeItemReaction(
  itemId: string,
  reactionType: ItemReactionType
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("item_reactions")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", user.id)
      .eq("reaction_type", reactionType);

    if (error) {
      return { error: error.message };
    }

    return { data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to remove reaction",
    };
  }
}
