/**
 * Reaction counting/toggle logic tests.
 *
 * The end-to-end harness (test-reactions.mjs) needs a confirmed Supabase user
 * to sign in with. This file covers the parts that don't: the count aggregation
 * and toggle-direction rules, run against an in-memory stand-in for the
 * item_reactions table that enforces the same (item_id, user_id, reaction_type)
 * primary key.
 *
 * Usage: node scripts/test-reaction-counts.mjs
 */

const REACTION_TYPES = ["thumbs_up", "insightful", "favorite"];

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * Stand-in for public.item_reactions with the same primary key
 * (item_id, user_id, reaction_type), so a duplicate insert is rejected exactly
 * as the database would reject it.
 */
class ReactionTable {
  constructor() {
    this.rows = new Map();
  }

  #key(itemId, userId, type) {
    return `${itemId}|${userId}|${type}`;
  }

  insert(itemId, userId, type) {
    const key = this.#key(itemId, userId, type);
    if (this.rows.has(key)) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      throw err;
    }
    this.rows.set(key, { itemId, userId, type });
  }

  delete(itemId, userId, type) {
    return this.rows.delete(this.#key(itemId, userId, type));
  }

  has(itemId, userId, type) {
    return this.rows.has(this.#key(itemId, userId, type));
  }

  forItem(itemId) {
    return [...this.rows.values()].filter((r) => r.itemId === itemId);
  }
}

/** Mirrors getItemReactions(): counts per type, plus the caller's own reactions. */
function summarize(table, itemId, viewerId = null) {
  const counts = Object.fromEntries(REACTION_TYPES.map((t) => [t, 0]));
  const userReactions = [];

  for (const row of table.forItem(itemId)) {
    if (row.type in counts) counts[row.type] += 1;
    if (viewerId && row.userId === viewerId) userReactions.push(row.type);
  }

  return { item_id: itemId, counts, userReactions };
}

/** Mirrors toggleItemReaction(): add when absent, remove when present. */
function toggle(table, itemId, userId, type) {
  if (table.has(itemId, userId, type)) {
    table.delete(itemId, userId, type);
    return { reacted: false };
  }
  try {
    table.insert(itemId, userId, type);
  } catch (err) {
    // Lost a race with a concurrent insert — the row exists, which is the
    // state the caller wanted.
    if (err.code !== "23505") throw err;
  }
  return { reacted: true };
}

/** Mirrors addItemReaction(): idempotent, never removes. */
function add(table, itemId, userId, type) {
  try {
    table.insert(itemId, userId, type);
  } catch (err) {
    if (err.code !== "23505") throw err;
  }
  return { reacted: true };
}

// ---------------------------------------------------------------------------

const ITEM = "item-1";
const OTHER_ITEM = "item-2";
const ALICE = "user-alice";
const BOB = "user-bob";

console.log("Reaction counting + toggle logic\n");

console.log("Insert and retrieval:");
{
  const t = new ReactionTable();

  const empty = summarize(t, ITEM, ALICE);
  check(
    "an item with no reactions counts zero across all types",
    REACTION_TYPES.every((type) => empty.counts[type] === 0)
  );
  check("no reactions means no userReactions", empty.userReactions.length === 0);

  toggle(t, ITEM, ALICE, "thumbs_up");
  const one = summarize(t, ITEM, ALICE);
  check("one reaction counts as 1", one.counts.thumbs_up === 1, JSON.stringify(one.counts));
  check("the other types stay at 0", one.counts.insightful === 0 && one.counts.favorite === 0);
  check("the reactor sees it in userReactions", one.userReactions.includes("thumbs_up"));

  const anonView = summarize(t, ITEM, null);
  check("counts are visible anonymously", anonView.counts.thumbs_up === 1);
  check("an anonymous viewer has no userReactions", anonView.userReactions.length === 0);

  const bobView = summarize(t, ITEM, BOB);
  check("another user sees the count but not their own reaction",
    bobView.counts.thumbs_up === 1 && bobView.userReactions.length === 0);
}

console.log("\nMultiple users:");
{
  const t = new ReactionTable();
  toggle(t, ITEM, ALICE, "thumbs_up");
  toggle(t, ITEM, BOB, "thumbs_up");

  const s = summarize(t, ITEM, ALICE);
  check("two users on the same type count as 2", s.counts.thumbs_up === 2, `got ${s.counts.thumbs_up}`);
  check("each user still sees only their own reaction", s.userReactions.length === 1);

  toggle(t, ITEM, BOB, "favorite");
  const s2 = summarize(t, ITEM, BOB);
  check("a different type counts separately",
    s2.counts.thumbs_up === 2 && s2.counts.favorite === 1,
    JSON.stringify(s2.counts));
  check("Bob sees both of his own reactions",
    s2.userReactions.includes("thumbs_up") && s2.userReactions.includes("favorite"));
}

console.log("\nCardinality rules:");
{
  const t = new ReactionTable();

  // A user may hold several *different* types on one item.
  toggle(t, ITEM, ALICE, "thumbs_up");
  toggle(t, ITEM, ALICE, "insightful");
  toggle(t, ITEM, ALICE, "favorite");
  const s = summarize(t, ITEM, ALICE);
  check("one user may hold all three distinct types",
    s.counts.thumbs_up === 1 && s.counts.insightful === 1 && s.counts.favorite === 1);
  check("all three appear in userReactions", s.userReactions.length === 3);

  // ...but never the same type twice.
  add(t, ITEM, ALICE, "thumbs_up");
  add(t, ITEM, ALICE, "thumbs_up");
  check("repeated add never double-counts",
    summarize(t, ITEM, ALICE).counts.thumbs_up === 1);

  let threw = false;
  try {
    t.insert(ITEM, ALICE, "thumbs_up");
  } catch (err) {
    threw = err.code === "23505";
  }
  check("a raw duplicate insert violates the primary key", threw);
}

console.log("\nToggle direction:");
{
  const t = new ReactionTable();

  const on = toggle(t, ITEM, ALICE, "thumbs_up");
  check("first toggle reports reacted=true", on.reacted === true);
  check("first toggle sets the count to 1", summarize(t, ITEM).counts.thumbs_up === 1);

  const off = toggle(t, ITEM, ALICE, "thumbs_up");
  check("second toggle reports reacted=false", off.reacted === false);
  check("second toggle returns the count to 0", summarize(t, ITEM).counts.thumbs_up === 0);

  const onAgain = toggle(t, ITEM, ALICE, "thumbs_up");
  check("toggling again re-adds it", onAgain.reacted === true &&
    summarize(t, ITEM).counts.thumbs_up === 1);

  // Toggling one type must not disturb another.
  toggle(t, ITEM, ALICE, "favorite");
  toggle(t, ITEM, ALICE, "thumbs_up");
  const s = summarize(t, ITEM, ALICE);
  check("toggling one type leaves the other intact",
    s.counts.thumbs_up === 0 && s.counts.favorite === 1,
    JSON.stringify(s.counts));

  // Removing one user's reaction must not affect another's.
  toggle(t, ITEM, BOB, "favorite");
  toggle(t, ITEM, ALICE, "favorite");
  check("one user's removal leaves the other user's reaction",
    summarize(t, ITEM).counts.favorite === 1);
}

console.log("\nItem isolation:");
{
  const t = new ReactionTable();
  toggle(t, ITEM, ALICE, "thumbs_up");
  toggle(t, OTHER_ITEM, ALICE, "thumbs_up");

  check("each item counts independently",
    summarize(t, ITEM).counts.thumbs_up === 1 &&
      summarize(t, OTHER_ITEM).counts.thumbs_up === 1);

  toggle(t, OTHER_ITEM, ALICE, "thumbs_up");
  check("removing from one item leaves the other untouched",
    summarize(t, ITEM).counts.thumbs_up === 1 &&
      summarize(t, OTHER_ITEM).counts.thumbs_up === 0);
}

console.log("\nConcurrency:");
{
  const t = new ReactionTable();
  // Two racing inserts of the same reaction: the second hits the primary key
  // and is swallowed, so the reaction exists exactly once.
  add(t, ITEM, ALICE, "thumbs_up");
  add(t, ITEM, ALICE, "thumbs_up");
  check("racing inserts converge on a single row",
    summarize(t, ITEM).counts.thumbs_up === 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
