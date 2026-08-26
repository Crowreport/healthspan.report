/**
 * Library API test harness.
 *
 * Exercises the /api/library routes against a running dev server: auth
 * enforcement, validation, save/unsave, folder create/list/delete, moving items
 * between folders, and cross-user privacy.
 *
 * Usage:
 *   node scripts/test-library.mjs
 *
 * Requires:
 *   - a dev server on BASE_URL (default http://localhost:3000)
 *   - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env
 *   - TEST_USER_EMAIL / TEST_USER_PASSWORD for a confirmed user, and
 *     TEST_USER2_EMAIL / TEST_USER2_PASSWORD for the privacy checks
 *
 * The authenticated cases are skipped with a clear notice when no credentials
 * are supplied, so the unauthenticated half still runs anywhere.
 */

import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function skip(name, why) {
  skipped++;
  console.log(`  ⊘ ${name} — ${why}`);
}

/** Sign in and return the session as an @supabase/ssr-readable cookie. */
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const session = await res.json();
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  return { userId: session.user.id, cookie: `sb-${ref}-auth-token=${value}` };
}

async function findItems(n = 2) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rss_items?select=id,title&limit=${n}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < n) {
    throw new Error(`Need ${n} rss_items rows, found ${rows?.length ?? 0}`);
  }
  return rows;
}

async function api(method, pathname, { body, cookie } = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log(`Library API tests → ${BASE_URL}\n`);

  const [itemA, itemB] = await findItems(2);
  console.log(`Items: ${itemA.id}, ${itemB.id}\n`);

  // --- auth enforcement ----------------------------------------------------
  console.log("Unauthenticated (every route must refuse):");

  const anon = [
    ["POST", "/api/library/save", { item_id: itemA.id }],
    ["POST", "/api/library/unsave", { item_id: itemA.id }],
    ["GET", "/api/library/saved", null],
    ["GET", "/api/library/folders", null],
    ["POST", "/api/library/folders", { name: "Sneaky" }],
    ["PATCH", "/api/library/saved", { item_id: itemA.id, folder_id: null }],
    ["DELETE", "/api/library/folders?id=00000000-0000-0000-0000-000000000000", null],
  ];

  for (const [method, pathname, body] of anon) {
    const r = await api(method, pathname, body ? { body } : {});
    check(`${method} ${pathname.split("?")[0]} → 401`, r.status === 401, `got ${r.status}`);
  }

  // --- authenticated -------------------------------------------------------
  console.log("\nAuthenticated:");

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    skip("all authenticated cases", "set TEST_USER_EMAIL / TEST_USER_PASSWORD");
    return report();
  }

  const u1 = await signIn(email, password);
  const c1 = u1.cookie;
  console.log(`  signed in as ${email} (${u1.userId})`);

  // Clean slate.
  await api("POST", "/api/library/unsave", { body: { item_id: itemA.id }, cookie: c1 });
  await api("POST", "/api/library/unsave", { body: { item_id: itemB.id }, cookie: c1 });
  const startFolders = (await api("GET", "/api/library/folders", { cookie: c1 })).body;
  for (const f of startFolders?.folders ?? []) {
    if (f.name.startsWith("QA ")) {
      await api("DELETE", `/api/library/folders?id=${f.id}`, { cookie: c1 });
    }
  }

  // Validation
  const badItem = await api("POST", "/api/library/save", {
    body: { item_id: "nope" }, cookie: c1,
  });
  check("save with a non-UUID item_id → 400", badItem.status === 400, `got ${badItem.status}`);

  const missingItem = await api("POST", "/api/library/save", {
    body: { item_id: "00000000-0000-0000-0000-000000000000" }, cookie: c1,
  });
  check("save of a nonexistent item → 404", missingItem.status === 404,
    `got ${missingItem.status}`);

  const blankFolder = await api("POST", "/api/library/folders", {
    body: { name: "   " }, cookie: c1,
  });
  check("blank folder name → 400", blankFolder.status === 400, `got ${blankFolder.status}`);

  const noDest = await api("PATCH", "/api/library/saved", {
    body: { item_id: itemA.id }, cookie: c1,
  });
  check("move without folder_id → 400", noDest.status === 400, `got ${noDest.status}`);

  // Save
  const save1 = await api("POST", "/api/library/save", {
    body: { item_id: itemA.id }, cookie: c1,
  });
  check("first save → 201", save1.status === 201, `got ${save1.status}`);
  check("first save reports created=true", save1.body?.created === true);
  check("a new save is unfiled", save1.body?.saved?.folder_id === null);

  const save2 = await api("POST", "/api/library/save", {
    body: { item_id: itemA.id }, cookie: c1,
  });
  check("re-save → 200, not a conflict", save2.status === 200, `got ${save2.status}`);
  check("re-save reports created=false", save2.body?.created === false);

  // List
  const listed = await api("GET", "/api/library/saved", { cookie: c1 });
  check("saved list includes the item",
    listed.body?.items?.some((s) => s.item_id === itemA.id));
  check("re-saving did not duplicate the row",
    listed.body.items.filter((s) => s.item_id === itemA.id).length === 1);
  check("the list joins the content item",
    listed.body.items.find((s) => s.item_id === itemA.id)?.item?.title != null);

  // Folders
  const mk = await api("POST", "/api/library/folders", {
    body: { name: "QA Sleep" }, cookie: c1,
  });
  check("folder create → 201", mk.status === 201, `got ${mk.status}`);
  const folderId = mk.body?.folder?.id;

  const dup = await api("POST", "/api/library/folders", {
    body: { name: "qa sleep" }, cookie: c1,
  });
  check("duplicate folder name (different case) → 409", dup.status === 409,
    `got ${dup.status}`);

  const folders = await api("GET", "/api/library/folders", { cookie: c1 });
  check("folder list includes the new folder",
    folders.body?.folders?.some((f) => f.id === folderId));

  // Move
  const moved = await api("PATCH", "/api/library/saved", {
    body: { item_id: itemA.id, folder_id: folderId }, cookie: c1,
  });
  check("move into a folder → 200", moved.status === 200, `got ${moved.status}`);
  check("folder_id is updated", moved.body?.saved?.folder_id === folderId);

  const inFolder = await api("GET", `/api/library/saved?folder=${folderId}`, { cookie: c1 });
  check("filtering by folder returns the item",
    inFolder.body?.items?.some((s) => s.item_id === itemA.id));

  await api("POST", "/api/library/save", {
    body: { item_id: itemB.id }, cookie: c1,
  });
  const unfiled = await api("GET", "/api/library/saved?folder=none", { cookie: c1 });
  check("folder=none returns only unfiled items",
    unfiled.body?.items?.every((s) => s.folder_id === null) &&
      unfiled.body.items.some((s) => s.item_id === itemB.id));

  const counted = await api("GET", "/api/library/folders", { cookie: c1 });
  check("folder item_count reflects filed items",
    counted.body?.folders?.find((f) => f.id === folderId)?.item_count === 1);

  const unfiledAgain = await api("PATCH", "/api/library/saved", {
    body: { item_id: itemA.id, folder_id: null }, cookie: c1,
  });
  check("moving to null unfiles the item",
    unfiledAgain.body?.saved?.folder_id === null);

  // Unsave
  const un1 = await api("POST", "/api/library/unsave", {
    body: { item_id: itemA.id }, cookie: c1,
  });
  check("unsave reports removed=true", un1.body?.removed === true);
  const un2 = await api("POST", "/api/library/unsave", {
    body: { item_id: itemA.id }, cookie: c1,
  });
  check("unsaving again reports removed=false (not 404)",
    un2.status === 200 && un2.body?.removed === false);

  // Folder deletion keeps contents
  await api("POST", "/api/library/save", {
    body: { item_id: itemA.id, folder_id: folderId }, cookie: c1,
  });
  await api("DELETE", `/api/library/folders?id=${folderId}`, { cookie: c1 });
  const afterDelete = await api("GET", "/api/library/saved", { cookie: c1 });
  check("deleting a folder keeps its items",
    afterDelete.body?.items?.some((s) => s.item_id === itemA.id));
  check("and unfiles them",
    afterDelete.body.items.find((s) => s.item_id === itemA.id)?.folder_id === null);

  // --- privacy -------------------------------------------------------------
  console.log("\nPrivacy (two users):");

  const email2 = process.env.TEST_USER2_EMAIL;
  const password2 = process.env.TEST_USER2_PASSWORD;

  if (!email2 || !password2) {
    skip("cross-user privacy checks", "set TEST_USER2_EMAIL / TEST_USER2_PASSWORD");
  } else {
    const u2 = await signIn(email2, password2);
    const c2 = u2.cookie;

    const f1 = await api("POST", "/api/library/folders", {
      body: { name: "QA Private" }, cookie: c1,
    });
    const privateFolder = f1.body?.folder?.id;
    await api("POST", "/api/library/save", {
      body: { item_id: itemA.id, folder_id: privateFolder }, cookie: c1,
    });

    const u2Folders = await api("GET", "/api/library/folders", { cookie: c2 });
    check("user 2 cannot see user 1's folders",
      !u2Folders.body?.folders?.some((f) => f.id === privateFolder));

    const u2Saved = await api("GET", "/api/library/saved", { cookie: c2 });
    check("user 2's saved list excludes user 1's rows",
      !u2Saved.body?.items?.some((s) => s.user_id === u1.userId));

    // Filing into someone else's folder must fail, not silently succeed.
    await api("POST", "/api/library/save", { body: { item_id: itemB.id }, cookie: c2 });
    const steal = await api("PATCH", "/api/library/saved", {
      body: { item_id: itemB.id, folder_id: privateFolder }, cookie: c2,
    });
    check("user 2 cannot move an item into user 1's folder",
      steal.status === 404, `got ${steal.status}`);

    const stealOnSave = await api("POST", "/api/library/save", {
      body: { item_id: itemB.id, folder_id: privateFolder }, cookie: c2,
    });
    check("user 2 cannot save into user 1's folder",
      stealOnSave.status === 404, `got ${stealOnSave.status}`);

    const stealDelete = await api("DELETE", `/api/library/folders?id=${privateFolder}`, {
      cookie: c2,
    });
    check("user 2 cannot delete user 1's folder",
      stealDelete.status === 404, `got ${stealDelete.status}`);

    const stillThere = await api("GET", "/api/library/folders", { cookie: c1 });
    check("user 1's folder survived",
      stillThere.body?.folders?.some((f) => f.id === privateFolder));

    // Same item saved by both users stays independent.
    await api("POST", "/api/library/save", { body: { item_id: itemA.id }, cookie: c2 });
    await api("POST", "/api/library/unsave", { body: { item_id: itemA.id }, cookie: c2 });
    const u1Still = await api("GET", "/api/library/saved", { cookie: c1 });
    check("user 2's unsave did not remove user 1's save",
      u1Still.body?.items?.some((s) => s.item_id === itemA.id));

    // Cleanup user 2
    await api("POST", "/api/library/unsave", { body: { item_id: itemB.id }, cookie: c2 });
    await api("DELETE", `/api/library/folders?id=${privateFolder}`, { cookie: c1 });
  }

  // Cleanup user 1
  await api("POST", "/api/library/unsave", { body: { item_id: itemA.id }, cookie: c1 });
  await api("POST", "/api/library/unsave", { body: { item_id: itemB.id }, cookie: c1 });

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nHarness error:", err.message);
  process.exit(1);
});
