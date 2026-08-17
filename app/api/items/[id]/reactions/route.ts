/**
 * Item Reactions API
 *
 * GET  /api/items/{id}/reactions — reaction counts for an item.
 * POST /api/items/{id}/reactions — add or toggle the caller's reaction.
 *
 * Reads are public: counts are shown to anonymous visitors. Writes require a
 * logged-in user, and RLS additionally pins every row to auth.uid(), so a
 * request can never react on someone else's behalf even if this handler were
 * bypassed.
 *
 * A user may hold several distinct reaction types on one item simultaneously
 * (thumbs_up + favorite), but never the same type twice — see migration 016.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getItemReactions,
  addItemReaction,
  removeItemReaction,
  toggleItemReaction,
} from "@/lib/actions/reactions";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ITEM_REACTION_TYPES,
  type ItemReactionType,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST body actions. `toggle` is the default — it's what a reaction button does. */
const ACTIONS = ["toggle", "add", "remove"] as const;
type ReactionAction = (typeof ACTIONS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Confirm the item exists before reacting to it.
 *
 * Without this, a POST for a nonexistent item fails on the foreign key and
 * surfaces as a 500 — this turns that into a 404. Reactions on hidden items are
 * still allowed: `hidden_by_admin` controls display, and a row the caller can't
 * see is filtered by RLS anyway.
 */
async function itemExists(itemId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("rss_items")
    .select("id", { count: "exact", head: true })
    .eq("id", itemId);

  if (error) {
    // Treat an unreadable check as "exists" and let the write path report the
    // real failure, rather than reporting a misleading 404.
    console.error("[Reactions API] Item lookup failed:", error);
    return true;
  }

  return (count ?? 0) > 0;
}

/**
 * GET /api/items/{id}/reactions
 *
 * Response: { item_id, counts: { thumbs_up, insightful, favorite },
 *             userReactions: [...], total }
 *
 * `userReactions` is the caller's own reactions, and is always `[]` for
 * anonymous callers.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Item id must be a UUID" },
      { status: 400 }
    );
  }

  const result = await getItemReactions(id);

  if (result.error || !result.data) {
    console.error("[Reactions API] GET failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to fetch reactions" },
      { status: 500 }
    );
  }

  const { counts, userReactions } = result.data;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return NextResponse.json({
    item_id: id,
    counts,
    userReactions,
    total,
  });
}

/**
 * POST /api/items/{id}/reactions
 *
 * Body: { reaction_type: 'thumbs_up' | 'insightful' | 'favorite',
 *         action?: 'toggle' | 'add' | 'remove' }
 *
 * `action` defaults to `toggle`: adds the reaction if the user doesn't hold it,
 * removes it if they do. `add` and `remove` are explicit one-way variants for
 * clients that already know the desired end state.
 *
 * Responds with the post-write counts so a client needs a single round trip per
 * tap rather than a follow-up GET.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Item id must be a UUID" },
      { status: 400 }
    );
  }

  // Auth is checked here as well as in the server actions so an unauthenticated
  // request gets a 401 before any database work happens.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to react" },
      { status: 401 }
    );
  }

  let body: { reaction_type?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reactionType = body.reaction_type;
  if (
    typeof reactionType !== "string" ||
    !ITEM_REACTION_TYPES.includes(reactionType as ItemReactionType)
  ) {
    return NextResponse.json(
      {
        error: `reaction_type must be one of: ${ITEM_REACTION_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  let action: ReactionAction = "toggle";
  if (body.action !== undefined) {
    if (
      typeof body.action !== "string" ||
      !ACTIONS.includes(body.action as ReactionAction)
    ) {
      return NextResponse.json(
        { error: `action must be one of: ${ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }
    action = body.action as ReactionAction;
  }

  if (!(await itemExists(id))) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const type = reactionType as ItemReactionType;
  let reacted: boolean;

  if (action === "toggle") {
    const result = await toggleItemReaction(id, type);
    if (result.error || !result.data) {
      console.error("[Reactions API] toggle failed:", result.error);
      return NextResponse.json(
        { error: result.error ?? "Failed to toggle reaction" },
        { status: 500 }
      );
    }
    reacted = result.data.reacted;
  } else if (action === "add") {
    const result = await addItemReaction(id, type);
    if (result.error) {
      console.error("[Reactions API] add failed:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    reacted = true;
  } else {
    const result = await removeItemReaction(id, type);
    if (result.error) {
      console.error("[Reactions API] remove failed:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    reacted = false;
  }

  // Return fresh counts so the client can render the new state directly.
  const summary = await getItemReactions(id);
  if (summary.error || !summary.data) {
    console.error("[Reactions API] count refresh failed:", summary.error);
    return NextResponse.json(
      { error: summary.error ?? "Failed to fetch reactions" },
      { status: 500 }
    );
  }

  const { counts, userReactions } = summary.data;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return NextResponse.json({
    item_id: id,
    reaction_type: type,
    reacted,
    counts,
    userReactions,
    total,
  });
}
