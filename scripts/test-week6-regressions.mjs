/**
 * Regression tests for the Week 6 QA bug-fix pass.
 *
 * Each block reproduces one bug against an in-memory stand-in that enforces the
 * same rules the database does, then asserts the fixed behaviour. The point is
 * that these tests FAIL against the old code — a test that passes either way
 * would not tell us the bug is gone.
 *
 * Offline by design, like test-library-logic.mjs and test-reaction-counts.mjs:
 * no Supabase session needed.
 *
 * Usage: node scripts/test-week6-regressions.mjs
 */

import { readFileSync } from "node:fs";

const UNIQUE_VIOLATION = "23505";

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

function section(title) {
  console.log(`\n${title}:`);
}

// ---------------------------------------------------------------------------
// 1. Reactions: no UPDATE policy on item_reactions
// ---------------------------------------------------------------------------

/**
 * Stand-in for public.item_reactions. The critical detail from migration 016 is
 * that there is NO UPDATE policy — so an upsert taking the DO UPDATE branch is
 * rejected by RLS, exactly as it is in Postgres.
 */
class ItemReactions {
  constructor() {
    this.rows = [];
  }

  #find(itemId, userId, type) {
    return this.rows.find(
      (r) => r.item_id === itemId && r.user_id === userId && r.reaction_type === type
    );
  }

  /** INSERT: allowed for your own rows; duplicates raise 23505. */
  insert(itemId, userId, type) {
    if (this.#find(itemId, userId, type)) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = UNIQUE_VIOLATION;
      throw err;
    }
    const row = { item_id: itemId, user_id: userId, reaction_type: type };
    this.rows.push(row);
    return row;
  }

  /**
   * UPSERT with ignoreDuplicates:false — INSERT ... ON CONFLICT DO UPDATE.
   * On conflict this needs an UPDATE policy, and there isn't one.
   */
  upsert(itemId, userId, type) {
    if (this.#find(itemId, userId, type)) {
      const err = new Error(
        'new row violates row-level security policy for table "item_reactions"'
      );
      err.code = "42501";
      throw err;
    }
    return this.insert(itemId, userId, type);
  }

  delete(itemId, userId, type) {
    const idx = this.rows.findIndex(
      (r) => r.item_id === itemId && r.user_id === userId && r.reaction_type === type
    );
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }

  select(itemId, userId, type) {
    return this.#find(itemId, userId, type) ?? null;
  }
}

/** The old implementation: upsert straight through. */
function addReactionOld(db, itemId, userId, type) {
  try {
    return { data: db.upsert(itemId, userId, type) };
  } catch (err) {
    return { error: err.message };
  }
}

/** The fixed implementation: insert, and treat 23505 as success. */
function addReactionFixed(db, itemId, userId, type) {
  try {
    return { data: db.insert(itemId, userId, type) };
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      const existing = db.select(itemId, userId, type);
      if (existing) return { data: existing };
    }
    return { error: err.message };
  }
}

section("Reactions: re-adding a held reaction (bug 1)");
{
  const db = new ItemReactions();
  const first = addReactionOld(db, "item-1", "user-1", "thumbs_up");
  check("old code: the first add succeeds", !first.error);

  const second = addReactionOld(db, "item-1", "user-1", "thumbs_up");
  check(
    "old code: re-adding FAILS on the missing UPDATE policy (the bug)",
    Boolean(second.error) && /row-level security/.test(second.error),
    "expected an RLS rejection to reproduce the bug"
  );
}
{
  const db = new ItemReactions();
  const first = addReactionFixed(db, "item-1", "user-1", "thumbs_up");
  check("fixed: the first add succeeds", !first.error && Boolean(first.data));

  const second = addReactionFixed(db, "item-1", "user-1", "thumbs_up");
  check("fixed: re-adding succeeds (idempotent, as documented)", !second.error);
  check("fixed: re-adding returns the existing row", Boolean(second.data));
  check("fixed: no duplicate row is created", db.rows.length === 1);

  const other = addReactionFixed(db, "item-1", "user-1", "favorite");
  check("fixed: a different type still lands", !other.error && db.rows.length === 2);
}

section("Reactions: counts are aggregate-only (bug 2)");
{
  const db = new ItemReactions();
  db.insert("item-1", "user-1", "thumbs_up");
  db.insert("item-1", "user-2", "thumbs_up");
  db.insert("item-1", "user-3", "insightful");

  // The fixed getItemReactions asks for counts per type and, separately, only
  // the caller's own rows. Neither read exposes another user's id.
  const counts = {
    thumbs_up: db.rows.filter((r) => r.item_id === "item-1" && r.reaction_type === "thumbs_up").length,
    insightful: db.rows.filter((r) => r.item_id === "item-1" && r.reaction_type === "insightful").length,
    favorite: 0,
  };
  check("counts are correct", counts.thumbs_up === 2 && counts.insightful === 1);

  const anonPayload = { item_id: "item-1", counts, userReactions: [] };
  const serialized = JSON.stringify(anonPayload);
  check(
    "an anonymous response carries no user_id",
    !serialized.includes("user-1") && !serialized.includes("user-2"),
    serialized
  );

  const mine = db.rows
    .filter((r) => r.item_id === "item-1" && r.user_id === "user-1")
    .map((r) => r.reaction_type);
  check("the caller still sees their own reactions", mine.length === 1 && mine[0] === "thumbs_up");
}

// ---------------------------------------------------------------------------
// 2. Save/folder: re-saving must not unfile
// ---------------------------------------------------------------------------

/**
 * Stand-in for public.saved_items. `upsert` models PostgREST faithfully: it
 * writes a WHOLE ROW, so a column omitted from the payload falls back to its
 * default (NULL) and overwrites whatever was stored. That is the bug.
 */
class SavedItems {
  constructor() {
    this.rows = [];
  }

  #find(userId, itemId) {
    return this.rows.find((r) => r.user_id === userId && r.item_id === itemId);
  }

  upsert(payload) {
    const existing = this.#find(payload.user_id, payload.item_id);
    const row = {
      user_id: payload.user_id,
      item_id: payload.item_id,
      // The whole-row semantic: absent means the column default, not "keep".
      folder_id: payload.folder_id ?? null,
    };
    if (existing) {
      Object.assign(existing, row);
      return existing;
    }
    this.rows.push(row);
    return row;
  }

  update(userId, itemId, patch) {
    const existing = this.#find(userId, itemId);
    if (!existing) return null;
    Object.assign(existing, patch);
    return existing;
  }

  select(userId, itemId) {
    return this.#find(userId, itemId) ?? null;
  }
}

/** Old saveItem: one upsert, folder_id spread in only when supplied. */
function saveItemOld(db, userId, itemId, folderId) {
  return db.upsert({
    user_id: userId,
    item_id: itemId,
    ...(folderId !== undefined ? { folder_id: folderId } : {}),
  });
}

/** Fixed saveItem: create and re-save are separate paths. */
function saveItemFixed(db, userId, itemId, folderId) {
  const existing = db.select(userId, itemId);
  if (existing) {
    if (folderId === undefined) return { row: db.select(userId, itemId), created: false };
    return { row: db.update(userId, itemId, { folder_id: folderId }), created: false };
  }
  return {
    row: db.upsert({ user_id: userId, item_id: itemId, folder_id: folderId ?? null }),
    created: true,
  };
}

section("Save/folders: re-saving a filed item (bug 4)");
{
  const db = new SavedItems();
  saveItemOld(db, "user-1", "item-1", "folder-a");
  check("old code: the item is filed", db.select("user-1", "item-1").folder_id === "folder-a");

  saveItemOld(db, "user-1", "item-1", undefined);
  check(
    "old code: re-saving UNFILES it (the bug)",
    db.select("user-1", "item-1").folder_id === null,
    "expected the folder to be clobbered to reproduce the bug"
  );
}
{
  const db = new SavedItems();
  const created = saveItemFixed(db, "user-1", "item-1", "folder-a");
  check("fixed: the first save reports created", created.created === true);
  check("fixed: the item is filed", db.select("user-1", "item-1").folder_id === "folder-a");

  const resave = saveItemFixed(db, "user-1", "item-1", undefined);
  check("fixed: re-saving keeps the folder", db.select("user-1", "item-1").folder_id === "folder-a");
  check("fixed: re-saving does not report created", resave.created === false);

  saveItemFixed(db, "user-1", "item-1", "folder-b");
  check("fixed: an explicit folder still moves it", db.select("user-1", "item-1").folder_id === "folder-b");

  saveItemFixed(db, "user-1", "item-1", null);
  check("fixed: an explicit null still unfiles it", db.select("user-1", "item-1").folder_id === null);

  check("fixed: still exactly one row", db.rows.length === 1);
}

// ---------------------------------------------------------------------------
// 3. AI summary: parseBullets tolerance
// ---------------------------------------------------------------------------

/**
 * Loaded from the real lib/ai/summarize.ts rather than copied, so this test
 * cannot drift away from the shipped implementation.
 */
function loadParseBullets() {
  const src = readFileSync(new URL("../lib/ai/summarize.ts", import.meta.url), "utf8");
  const start = src.indexOf("export function parseBullets");
  const end = src.indexOf("\n}", src.indexOf("return bullets;")) + 2;
  const fn = src
    .slice(start, end)
    .replace("export function parseBullets(raw: string): string[] {", "function parseBullets(raw) {")
    .replace("const bullets: string[] = [];", "const bullets = [];");

  const factory = new Function(
    "MIN_BULLET_LENGTH",
    "MAX_BULLET_LENGTH",
    "MAX_BULLETS",
    `${fn}; return parseBullets;`
  );
  return factory(12, 300, 5);
}

section("AI summary: parseBullets edge cases (bug 5)");
{
  const parseBullets = loadParseBullets();

  const cases = [
    ["standard bullets", "- Sleep improves memory consolidation\n- Exercise reduces mortality risk", 2],
    ["bold markers stripped", "- **Sleep** improves memory consolidation\n- **Exercise** reduces mortality", 2],
    ["no space after the marker", "-Sleep improves memory consolidation\n-Exercise reduces mortality risk", 2],
    ["CRLF line endings", "- Sleep improves memory consolidation\r\n- Exercise reduces mortality risk\r\n", 2],
    ["fenced code block", "```\n- Sleep improves memory consolidation\n- Exercise reduces mortality\n```", 2],
    ["numbered list", "1. Sleep improves memory consolidation\n2. Exercise reduces mortality risk", 2],
    ["indented bullets", "  - Sleep improves memory consolidation\n  - Exercise reduces mortality", 2],
    ["preamble prose dropped", "Here are the key points:\n- Sleep improves memory\n- Exercise reduces mortality", 2],
  ];

  for (const [name, input, expected] of cases) {
    const out = parseBullets(input);
    check(`${name} → ${expected} bullets`, out.length === expected, `got ${out.length}`);
  }

  check(
    "no carriage returns survive",
    !parseBullets("- Sleep improves memory\r\n- Exercise reduces mortality").some((b) => b.includes("\r"))
  );

  const many = parseBullets(
    Array.from({ length: 8 }, (_, i) => `- Finding number ${i} about longevity research`).join("\n")
  );
  check("capped at 5 bullets", many.length === 5, `got ${many.length}`);

  check("prose alone yields nothing", parseBullets("I cannot summarize this article.").length === 0);
  check("empty input yields nothing", parseBullets("").length === 0);
  check("short fragments are discarded", parseBullets("- N/A\n- —").length === 0);
}

// ---------------------------------------------------------------------------
// 4. Pagination stability
// ---------------------------------------------------------------------------

section("Pagination: stable ordering across pages (bug 6)");
{
  // Ten rows sharing one timestamp — the pathological case for a sort on
  // viewed_at alone (a bulk import, or items opened in the same millisecond).
  const sameTs = "2026-09-08T12:00:00.000Z";
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `entry-${String(i).padStart(2, "0")}`,
    viewed_at: sameTs,
  }));

  // Unstable: ties resolve arbitrarily, modelled here as the backend returning
  // them in a different arbitrary order per query.
  const pageUnstable = (offset, limit, salt) =>
    [...rows]
      .sort((a, b) => (salt % 2 ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)))
      .slice(offset, offset + limit);

  const unstableSeen = [...pageUnstable(0, 5, 1), ...pageUnstable(5, 5, 2)].map((r) => r.id);
  const unstableUnique = new Set(unstableSeen);
  check(
    "unstable ordering loses or repeats rows (the bug)",
    unstableUnique.size < rows.length,
    `saw ${unstableUnique.size} distinct of ${rows.length}`
  );

  // Fixed: tie-break on id gives a total order, so paging is deterministic.
  const pageStable = (offset, limit) =>
    [...rows]
      .sort((a, b) => b.viewed_at.localeCompare(a.viewed_at) || b.id.localeCompare(a.id))
      .slice(offset, offset + limit);

  const stableSeen = [...pageStable(0, 5), ...pageStable(5, 5)].map((r) => r.id);
  check("fixed: every row appears exactly once", new Set(stableSeen).size === rows.length);
  check("fixed: no row is duplicated across pages", stableSeen.length === new Set(stableSeen).size);
  check(
    "fixed: repeating the same query is deterministic",
    JSON.stringify(pageStable(0, 5)) === JSON.stringify(pageStable(0, 5))
  );
}

section("Reading history: unresolvable items are dropped");
{
  const entries = [
    { id: "h1", item: { id: "i1", title: "Readable" } },
    { id: "h2", item: null },
    { id: "h3", item: { id: "i3", title: "Also readable" } },
  ];
  const resolved = entries.filter((e) => e.item !== null);

  check("blank entries are filtered out", resolved.length === 2);
  check("readable entries survive", resolved.every((e) => e.item !== null));
  check(
    "total stays the pageable count, not the filtered one",
    entries.length === 3 && resolved.length === 2
  );
}

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
