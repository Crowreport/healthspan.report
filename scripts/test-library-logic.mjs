/**
 * Library (saved items + folders) logic tests.
 *
 * The end-to-end harness (test-library.mjs) needs a confirmed Supabase user to
 * sign in with. This file covers what doesn't: the save/unsave/move rules and
 * the ownership scoping, run against an in-memory stand-in that enforces the
 * same constraints as the real tables —
 *   - saved_items: unique (user_id, item_id)
 *   - folders:     unique (user_id, lower(trim(name)))
 *   - folder delete: ON DELETE SET NULL on saved_items.folder_id
 *   - RLS:         every read/write scoped to the acting user
 *
 * Usage: node scripts/test-library-logic.mjs
 */

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

const UNIQUE_VIOLATION = "23505";

/**
 * Stand-in for public.folders + public.saved_items with the same uniqueness
 * rules, cascade behaviour, and per-user RLS scoping as the migration.
 */
class Library {
  constructor() {
    this.folders = [];
    this.saved = [];
    this.seq = 0;
  }

  #id(prefix) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  // --- folders ---

  createFolder(userId, name) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new Error("Folder name is required");

    // Unique per user, case-insensitive — mirrors folders_user_name_unique_idx.
    const clash = this.folders.some(
      (f) => f.user_id === userId && f.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) {
      const err = new Error("duplicate folder name");
      err.code = UNIQUE_VIOLATION;
      throw err;
    }

    const folder = { id: this.#id("folder"), user_id: userId, name: trimmed };
    this.folders.push(folder);
    return folder;
  }

  /** RLS: a user only ever sees their own folders. */
  listFolders(userId) {
    return this.folders.filter((f) => f.user_id === userId);
  }

  /** Counts are per-user too, so they can't leak another user's activity. */
  listFoldersWithCounts(userId) {
    return this.listFolders(userId).map((f) => ({
      ...f,
      item_count: this.saved.filter(
        (s) => s.user_id === userId && s.folder_id === f.id
      ).length,
    }));
  }

  /** ON DELETE SET NULL: contents survive as unfiled. */
  deleteFolder(userId, folderId) {
    const idx = this.folders.findIndex(
      (f) => f.id === folderId && f.user_id === userId
    );
    if (idx === -1) return false;

    this.folders.splice(idx, 1);
    for (const row of this.saved) {
      if (row.folder_id === folderId) row.folder_id = null;
    }
    return true;
  }

  // --- saved items ---

  /**
   * Idempotent save. Re-saving returns the existing row; passing a folder moves
   * it; omitting the folder on a re-save leaves it where it is.
   */
  save(userId, itemId, folderId) {
    if (folderId !== undefined && folderId !== null) {
      // A folder must belong to the caller — mirrors the RLS WITH CHECK.
      const owned = this.folders.some(
        (f) => f.id === folderId && f.user_id === userId
      );
      if (!owned) throw new Error("Folder not found");
    }

    const existing = this.saved.find(
      (s) => s.user_id === userId && s.item_id === itemId
    );

    if (existing) {
      if (folderId !== undefined) existing.folder_id = folderId;
      return { row: existing, created: false };
    }

    const row = {
      id: this.#id("saved"),
      user_id: userId,
      item_id: itemId,
      folder_id: folderId ?? null,
    };
    this.saved.push(row);
    return { row, created: true };
  }

  unsave(userId, itemId) {
    const idx = this.saved.findIndex(
      (s) => s.user_id === userId && s.item_id === itemId
    );
    if (idx === -1) return { removed: false };
    this.saved.splice(idx, 1);
    return { removed: true };
  }

  /** folderId: undefined = all, null = unfiled only, string = that folder. */
  listSaved(userId, folderId) {
    let rows = this.saved.filter((s) => s.user_id === userId);
    if (folderId !== undefined) {
      rows = rows.filter((s) => s.folder_id === folderId);
    }
    return rows;
  }

  move(userId, itemId, folderId) {
    if (folderId !== null) {
      const owned = this.folders.some(
        (f) => f.id === folderId && f.user_id === userId
      );
      if (!owned) throw new Error("Folder not found");
    }
    const row = this.saved.find(
      (s) => s.user_id === userId && s.item_id === itemId
    );
    if (!row) throw new Error("Saved item not found");
    row.folder_id = folderId;
    return row;
  }
}

// ---------------------------------------------------------------------------

const ALICE = "user-alice";
const BOB = "user-bob";
const ITEM_A = "item-a";
const ITEM_B = "item-b";

console.log("Library: saved items + folders\n");

console.log("Save and list:");
{
  const lib = new Library();

  check("a new library is empty", lib.listSaved(ALICE).length === 0);

  const first = lib.save(ALICE, ITEM_A);
  check("saving reports created=true", first.created === true);
  check("a saved item is unfiled by default", first.row.folder_id === null);
  check("the saved item appears in the list", lib.listSaved(ALICE).length === 1);

  const again = lib.save(ALICE, ITEM_A);
  check("re-saving reports created=false", again.created === false);
  check("re-saving does not duplicate the row", lib.listSaved(ALICE).length === 1,
    `got ${lib.listSaved(ALICE).length}`);
  check("re-saving returns the same row id", again.row.id === first.row.id);

  lib.save(ALICE, ITEM_B);
  check("a second item is listed separately", lib.listSaved(ALICE).length === 2);
}

console.log("\nUnsave:");
{
  const lib = new Library();
  lib.save(ALICE, ITEM_A);

  const gone = lib.unsave(ALICE, ITEM_A);
  check("unsaving a saved item reports removed=true", gone.removed === true);
  check("the item leaves the list", lib.listSaved(ALICE).length === 0);

  const noop = lib.unsave(ALICE, ITEM_A);
  check("unsaving again reports removed=false, not an error", noop.removed === false);

  lib.save(ALICE, ITEM_A);
  check("an item can be re-saved after unsaving", lib.listSaved(ALICE).length === 1);
}

console.log("\nFolders:");
{
  const lib = new Library();

  const sleep = lib.createFolder(ALICE, "Sleep");
  check("a folder is created", sleep.name === "Sleep");
  check("it appears in the folder list", lib.listFolders(ALICE).length === 1);

  let dupCode = null;
  try {
    lib.createFolder(ALICE, "Sleep");
  } catch (err) {
    dupCode = err.code;
  }
  check("a duplicate folder name is rejected", dupCode === UNIQUE_VIOLATION);

  let caseCode = null;
  try {
    lib.createFolder(ALICE, "  sleep  ");
  } catch (err) {
    caseCode = err.code;
  }
  check("duplicate detection is case- and whitespace-insensitive",
    caseCode === UNIQUE_VIOLATION);

  // Two users may each have a folder of the same name.
  const bobSleep = lib.createFolder(BOB, "Sleep");
  check("a different user may reuse the same folder name", bobSleep.id !== sleep.id);
  check("each user sees only their own folders",
    lib.listFolders(ALICE).length === 1 && lib.listFolders(BOB).length === 1);

  let blank = false;
  try {
    lib.createFolder(ALICE, "   ");
  } catch {
    blank = true;
  }
  check("a blank folder name is rejected", blank);
}

console.log("\nFiling items into folders:");
{
  const lib = new Library();
  const sleep = lib.createFolder(ALICE, "Sleep");
  const diet = lib.createFolder(ALICE, "Diet");

  const filed = lib.save(ALICE, ITEM_A, sleep.id);
  check("an item can be saved directly into a folder",
    filed.row.folder_id === sleep.id);

  lib.save(ALICE, ITEM_B);
  check("filtering by folder returns only that folder's items",
    lib.listSaved(ALICE, sleep.id).length === 1);
  check("filtering by null returns only unfiled items",
    lib.listSaved(ALICE, null).length === 1);
  check("no filter returns everything", lib.listSaved(ALICE).length === 2);

  lib.move(ALICE, ITEM_B, diet.id);
  check("moving an unfiled item files it",
    lib.listSaved(ALICE, diet.id).length === 1);
  check("it is no longer unfiled", lib.listSaved(ALICE, null).length === 0);

  lib.move(ALICE, ITEM_B, sleep.id);
  check("an item moves between folders",
    lib.listSaved(ALICE, sleep.id).length === 2 &&
      lib.listSaved(ALICE, diet.id).length === 0);

  lib.move(ALICE, ITEM_B, null);
  check("moving to null unfiles the item",
    lib.listSaved(ALICE, null).length === 1);

  const counts = lib.listFoldersWithCounts(ALICE);
  const sleepCount = counts.find((f) => f.id === sleep.id).item_count;
  check("folder item_count reflects filed items", sleepCount === 1, `got ${sleepCount}`);

  // Re-saving without a folder must not silently unfile something.
  lib.save(ALICE, ITEM_A);
  check("re-saving without a folder leaves the item filed",
    lib.listSaved(ALICE, sleep.id).length === 1);
}

console.log("\nFolder deletion:");
{
  const lib = new Library();
  const sleep = lib.createFolder(ALICE, "Sleep");
  lib.save(ALICE, ITEM_A, sleep.id);
  lib.save(ALICE, ITEM_B, sleep.id);

  const deleted = lib.deleteFolder(ALICE, sleep.id);
  check("the folder is deleted", deleted === true);
  check("the folder list is empty", lib.listFolders(ALICE).length === 0);
  check("its items are NOT deleted", lib.listSaved(ALICE).length === 2,
    `got ${lib.listSaved(ALICE).length}`);
  check("its items become unfiled", lib.listSaved(ALICE, null).length === 2);
}

console.log("\nPrivacy (ownership scoping):");
{
  const lib = new Library();
  const aliceFolder = lib.createFolder(ALICE, "Private");
  lib.save(ALICE, ITEM_A, aliceFolder.id);
  lib.save(BOB, ITEM_B);

  check("a user's saved list contains only their own rows",
    lib.listSaved(ALICE).length === 1 && lib.listSaved(BOB).length === 1);
  check("Alice's item is not in Bob's list",
    !lib.listSaved(BOB).some((s) => s.item_id === ITEM_A));
  check("Bob cannot see Alice's folders",
    lib.listFolders(BOB).length === 0);

  // The same item saved by both users is two independent rows.
  lib.save(BOB, ITEM_A);
  check("two users saving the same item are independent",
    lib.listSaved(ALICE).length === 1 && lib.listSaved(BOB).length === 2);

  // Bob must not be able to file into Alice's folder.
  let blocked = false;
  try {
    lib.save(BOB, ITEM_B, aliceFolder.id);
  } catch {
    blocked = true;
  }
  check("filing into another user's folder is rejected on save", blocked);

  let moveBlocked = false;
  try {
    lib.move(BOB, ITEM_B, aliceFolder.id);
  } catch {
    moveBlocked = true;
  }
  check("moving into another user's folder is rejected", moveBlocked);

  // Bob unsaving "the same item" must not touch Alice's row.
  lib.unsave(BOB, ITEM_A);
  check("one user's unsave does not affect the other's row",
    lib.listSaved(ALICE).length === 1);

  // Bob deleting a folder id he doesn't own is a no-op.
  const bogus = lib.deleteFolder(BOB, aliceFolder.id);
  check("deleting another user's folder fails", bogus === false);
  check("the owner still has the folder", lib.listFolders(ALICE).length === 1);
  check("and its contents are untouched",
    lib.listSaved(ALICE, aliceFolder.id).length === 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
