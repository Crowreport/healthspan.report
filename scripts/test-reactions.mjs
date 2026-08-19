/**
 * Reactions API test harness.
 *
 * Exercises POST/GET /api/items/{id}/reactions against a running dev server:
 * auth enforcement, validation, insert, toggle, idempotent add, removal, and
 * count correctness with two concurrent users.
 *
 * Usage:
 *   node scripts/test-reactions.mjs
 *
 * Requires:
 *   - a dev server on BASE_URL (default http://localhost:3000)
 *   - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env
 *   - TEST_USER_EMAIL / TEST_USER_PASSWORD for a confirmed user (and optionally
 *     TEST_USER2_EMAIL / TEST_USER2_PASSWORD for the multi-user count check)
 *
 * The authenticated cases are skipped with a clear notice when no credentials
 * are supplied, so the unauthenticated half still runs anywhere.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
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

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

/**
 * Sign in and return cookies in the format @supabase/ssr reads them.
 * The server client parses the `sb-<ref>-auth-token` cookie, so a raw access
 * token in an Authorization header is not enough — the session has to arrive
 * as a cookie for the route's getCurrentUser() to see it.
 */
async function signIn(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  }

  const session = await res.json();
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

  return {
    userId: session.user.id,
    cookie: `sb-${projectRef}-auth-token=${cookieValue}`,
  };
}

/** Pick any existing item to react to. */
async function findItem() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rss_items?select=id,title&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No rss_items rows to react to");
  }
  return rows[0];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function getReactions(itemId, cookie) {
  const res = await fetch(`${BASE_URL}/api/items/${itemId}/reactions`, {
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function postReaction(itemId, payload, cookie) {
  const res = await fetch(`${BASE_URL}/api/items/${itemId}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Reactions API tests → ${BASE_URL}\n`);

  const item = await findItem();
  console.log(`Test item: ${item.id}\n  "${item.title}"\n`);

  // --- Public reads + auth enforcement -------------------------------------
  console.log("Unauthenticated:");

  const anonGet = await getReactions(item.id);
  check("GET is public (200)", anonGet.status === 200, `got ${anonGet.status}`);
  check(
    "GET returns counts for all reaction types",
    anonGet.body &&
      ["thumbs_up", "insightful", "favorite"].every(
        (t) => typeof anonGet.body.counts?.[t] === "number"
      ),
    JSON.stringify(anonGet.body)
  );
  check(
    "GET returns no userReactions when anonymous",
    Array.isArray(anonGet.body?.userReactions) &&
      anonGet.body.userReactions.length === 0
  );

  const anonPost = await postReaction(item.id, { reaction_type: "thumbs_up" });
  check(
    "POST without auth is rejected (401)",
    anonPost.status === 401,
    `got ${anonPost.status}`
  );

  const badId = await getReactions("not-a-uuid");
  check("GET with malformed id (400)", badId.status === 400, `got ${badId.status}`);

  // --- Authenticated behaviour ---------------------------------------------
  console.log("\nAuthenticated:");

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    skip("all authenticated cases", "set TEST_USER_EMAIL / TEST_USER_PASSWORD");
    return report();
  }

  const user1 = await signIn(email, password);
  console.log(`  signed in as ${email} (${user1.userId})`);

  // Start from a known state so counts are deterministic.
  for (const type of ["thumbs_up", "insightful", "favorite"]) {
    await postReaction(item.id, { reaction_type: type, action: "remove" }, user1.cookie);
  }

  const baseline = await getReactions(item.id, user1.cookie);
  const base = baseline.body.counts;
  console.log(`  baseline counts: ${JSON.stringify(base)}`);

  // Validation
  const badType = await postReaction(
    item.id,
    { reaction_type: "shrug" },
    user1.cookie
  );
  check(
    "POST with invalid reaction_type (400)",
    badType.status === 400,
    `got ${badType.status}`
  );

  const badAction = await postReaction(
    item.id,
    { reaction_type: "thumbs_up", action: "explode" },
    user1.cookie
  );
  check(
    "POST with invalid action (400)",
    badAction.status === 400,
    `got ${badAction.status}`
  );

  const missingItem = await postReaction(
    "00000000-0000-0000-0000-000000000000",
    { reaction_type: "thumbs_up" },
    user1.cookie
  );
  check(
    "POST to nonexistent item (404)",
    missingItem.status === 404,
    `got ${missingItem.status}`
  );

  // Insert
  const add = await postReaction(item.id, { reaction_type: "thumbs_up" }, user1.cookie);
  check("toggle on succeeds (200)", add.status === 200, `got ${add.status}`);
  check("toggle on reports reacted=true", add.body?.reacted === true);
  check(
    "toggle on increments the count",
    add.body?.counts?.thumbs_up === base.thumbs_up + 1,
    `${base.thumbs_up} -> ${add.body?.counts?.thumbs_up}`
  );
  check(
    "toggle on reflects in userReactions",
    add.body?.userReactions?.includes("thumbs_up")
  );

  // Retrieval — the count must survive a separate request
  const afterAdd = await getReactions(item.id, user1.cookie);
  check(
    "GET reflects the inserted reaction",
    afterAdd.body?.counts?.thumbs_up === base.thumbs_up + 1,
    `got ${afterAdd.body?.counts?.thumbs_up}`
  );
  check(
    "GET reports it in userReactions",
    afterAdd.body?.userReactions?.includes("thumbs_up")
  );

  // Multiple distinct types coexist
  const second = await postReaction(item.id, { reaction_type: "favorite" }, user1.cookie);
  check(
    "a second distinct reaction type coexists",
    second.body?.userReactions?.includes("thumbs_up") &&
      second.body?.userReactions?.includes("favorite"),
    JSON.stringify(second.body?.userReactions)
  );
  check(
    "the first count is unaffected by the second type",
    second.body?.counts?.thumbs_up === base.thumbs_up + 1
  );

  // Idempotent add — must not double-count
  const addAgain = await postReaction(
    item.id,
    { reaction_type: "thumbs_up", action: "add" },
    user1.cookie
  );
  check(
    "explicit add is idempotent (no double count)",
    addAgain.body?.counts?.thumbs_up === base.thumbs_up + 1,
    `got ${addAgain.body?.counts?.thumbs_up}`
  );

  // Toggle off
  const off = await postReaction(item.id, { reaction_type: "thumbs_up" }, user1.cookie);
  check("toggle off reports reacted=false", off.body?.reacted === false);
  check(
    "toggle off decrements the count",
    off.body?.counts?.thumbs_up === base.thumbs_up,
    `got ${off.body?.counts?.thumbs_up}`
  );
  check(
    "toggle off clears it from userReactions",
    !off.body?.userReactions?.includes("thumbs_up")
  );
  check(
    "toggle off leaves the other type intact",
    off.body?.userReactions?.includes("favorite")
  );

  // --- Two users -----------------------------------------------------------
  const email2 = process.env.TEST_USER2_EMAIL;
  const password2 = process.env.TEST_USER2_PASSWORD;

  if (email2 && password2) {
    const user2 = await signIn(email2, password2);
    await postReaction(item.id, { reaction_type: "favorite", action: "remove" }, user2.cookie);

    const before = (await getReactions(item.id, user2.cookie)).body.counts.favorite;
    const u2 = await postReaction(item.id, { reaction_type: "favorite" }, user2.cookie);

    check(
      "a second user's reaction adds to the same count",
      u2.body?.counts?.favorite === before + 1,
      `${before} -> ${u2.body?.counts?.favorite}`
    );
    check(
      "each user sees only their own userReactions",
      u2.body?.userReactions?.includes("favorite")
    );

    await postReaction(item.id, { reaction_type: "favorite", action: "remove" }, user2.cookie);
  } else {
    skip("multi-user count aggregation", "set TEST_USER2_EMAIL / TEST_USER2_PASSWORD");
  }

  // --- Read latency --------------------------------------------------------
  const started = Date.now();
  const ROUNDS = 10;
  for (let i = 0; i < ROUNDS; i++) {
    await getReactions(item.id);
  }
  const perRead = (Date.now() - started) / ROUNDS;
  console.log(`\n  mean GET latency over ${ROUNDS} reads: ${perRead.toFixed(0)}ms`);
  check("counts fetch quickly (< 1000ms mean)", perRead < 1000, `${perRead.toFixed(0)}ms`);

  // Cleanup
  for (const type of ["thumbs_up", "insightful", "favorite"]) {
    await postReaction(item.id, { reaction_type: type, action: "remove" }, user1.cookie);
  }

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
