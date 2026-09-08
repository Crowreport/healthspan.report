# Week 6 QA Bug-Fix Pass

Root causes and fixes for the four QA areas. Each entry says what was actually
wrong, not just what changed.

## 1. Reactions not persisting

**Root cause.** `public.item_reactions` has **no UPDATE policy** — migration 016
omits it deliberately, because `reaction_type` is part of the primary key, so
changing a reaction is modelled as delete + insert.

`addItemReaction` used `.upsert(..., { ignoreDuplicates: false })`. A PostgREST
upsert compiles to `INSERT … ON CONFLICT DO UPDATE`, so re-adding a reaction the
user already held took the UPDATE branch — which RLS then rejected. The function
is documented as idempotent, but the "already held" path was the one that failed,
so a reaction the user re-applied appeared not to stick.

**Fix** ([lib/actions/reactions.ts](../lib/actions/reactions.ts)). Plain `INSERT`,
with the unique-violation code (`23505`) caught and the existing row read back —
which is what "idempotent" was supposed to mean. The hardcoded `"23505"` in
`toggleItemReaction` now uses the shared `UNIQUE_VIOLATION` constant.

## 2. Reaction counts: unbounded read + user_id leak

**Root cause.** `getItemReactions` selected `user_id, reaction_type` for **every
row** on the item and tallied them in JavaScript. Two problems: the read grew
linearly with popularity, and since the SELECT policy on `item_reactions` is
public (`USING (true)`), it handed every anonymous caller the `user_id` of
everyone who had reacted.

**Fix.** Three `head: true` exact counts, one per reaction type, which transfer
no rows at all. The caller's own reactions are a separate user-scoped read of at
most three rows — the only place a `user_id` is touched.

## 3. Reactions UI: silent failures and stale counts

**Root cause.** [components/ui/ReactionBar.tsx](../components/ui/ReactionBar.tsx)
had `if (!response.ok) return;`. A rejected write left the button looking exactly
as it had before, which is indistinguishable from a reaction that saved — this is
what made bug 1 present as "sometimes it works, sometimes it doesn't".

Separately, the fetch effect did not reset state on `itemId` change, so a
component remounted onto a different item (a feed reusing the node) showed the
previous item's counts until the new response landed.

**Fix.** Optimistic update with rollback and a visible inline message on failure
(401 reads "Log in to react"), plus a state reset when `itemId` changes.

## 4. Save/folder glitch: re-saving silently unfiled an item

**Root cause.** `saveItem` used one upsert for both the create and the re-save
path, spreading `folder_id` into the payload only when it was supplied:

```ts
...(folderId !== undefined ? { folder_id: folderId } : {})
```

The comment claimed omitting it "leaves the item where it already is". It does
not. A PostgREST upsert sends a **whole row**, so the omitted `folder_id` fell
back to the column default (`NULL`) and `DO UPDATE` wrote that over the stored
value. Re-saving an already-filed item from any button that did not carry a
folder id **moved it back to unfiled**.

**Fix** ([lib/actions/library.ts](../lib/actions/library.ts)). The two paths are
now separate. An existing row with no folder supplied is read back untouched; an
existing row with a folder supplied gets a targeted `UPDATE` of `folder_id`
alone; only a genuinely new save inserts, still via upsert so the two-tab race
resolves instead of hitting the unique index.

## 5. AI summary: valid responses rejected as failures

**Root cause.** `parseBullets` required whitespace after the list marker
(`/^([-*•‣–—]|\d+[.)])\s+/`). Models routinely emit `-Sleep improves…` with no
space. Those lines were classified as prose and dropped, so a complete, correct
response parsed to **zero bullets**, fell below `MIN_BULLETS`, and the route
returned a 502 "Could not generate a summary right now".

Two related cases: a response with CRLF line endings left a trailing `\r` on
every bullet, and a model wrapping its list in a ``` fence contributed the fence
line itself.

**Fix** ([lib/ai/summarize.ts](../lib/ai/summarize.ts)). Marker regex uses `\s*`,
splitting handles `\r?\n`, and fence lines are skipped.

Verified against eight realistic model-output shapes (bold markers, fences,
CRLF, indentation, missing space, numbered lists, preamble prose, and the
five-bullet cap) — all pass; the missing-space case went 0 → 2 bullets.

## 6. Reading history: unstable pagination and blank rows

**Root cause.** `getReadingHistory` ordered by `viewed_at` alone. That is not a
total order — items opened in the same millisecond sort arbitrarily — so as a
client paged through, a row could appear on two consecutive pages or be skipped
entirely. `getSavedItems` had the identical problem on `created_at`.

The joined `item` can also come back `null` for a row the caller can no longer
read, which rendered as a blank card.

**Fix.** Both queries tie-break on `id`. History drops entries whose `item` is
`null`. `total` deliberately stays the unfiltered count — it is the number of
rows the caller can page through, so adjusting it locally would make it disagree
with the offsets that actually work.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — the 6 pre-existing errors only (identical count on the
  stashed baseline); every file touched here lints clean.
- `npm run build` — succeeds; both new routes register as dynamic.
- `parseBullets` — 8/8 edge cases pass against the extracted function.

Not covered: no automated test suite exists in this repo, so the database-level
behaviour above (RLS branches, upsert semantics) was reasoned from the migration
definitions rather than executed against a live database. Worth a manual pass on
staging, particularly re-saving a filed item and re-applying an existing reaction.
