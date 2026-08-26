# Library API — Week 4 Backend

Save/bookmark items and organize them into folders (collections).

Migration: `supabase/migrations/018_saved_items_and_folders.sql`

## 1. Data model

### `public.saved_items`

| Column       | Type          | Notes                                                     |
| ------------ | ------------- | --------------------------------------------------------- |
| `id`         | `UUID`        | Primary key, `gen_random_uuid()`                           |
| `user_id`    | `UUID`        | → `users(id)` `ON DELETE CASCADE`                          |
| `item_id`    | `UUID`        | → `rss_items(id)` `ON DELETE CASCADE`                      |
| `folder_id`  | `UUID`        | → `folders(id)` `ON DELETE SET NULL`. **Nullable** = unfiled |
| `created_at` | `TIMESTAMPTZ` | Defaults to `NOW()`                                        |
| `updated_at` | `TIMESTAMPTZ` | Maintained by trigger                                      |

**One row per `(user_id, item_id)`**, enforced by a unique index. Saving is a
boolean, not a counter: a user either has an item saved or does not. The
surrogate `id` is kept as a convenient handle rather than using a composite
primary key.

`folder_id IS NULL` means **saved but not filed** — the default landing state.
`ON DELETE SET NULL` means deleting a folder returns its contents to unfiled
rather than destroying the user's bookmarks, which would be a surprising amount
of data loss for what reads like a tidying-up action.

### `public.folders`

| Column       | Type           | Notes                              |
| ------------ | -------------- | ---------------------------------- |
| `id`         | `UUID`         | Primary key                        |
| `user_id`    | `UUID`         | → `users(id)` `ON DELETE CASCADE`   |
| `name`       | `VARCHAR(100)` | Trimmed; blank names rejected      |
| `created_at` | `TIMESTAMPTZ`  | Defaults to `NOW()`                |
| `updated_at` | `TIMESTAMPTZ`  | Added by migration 018             |

Folder names are **unique per user, case-insensitively**
(`folders_user_name_unique_idx` on `(user_id, lower(btrim(name)))`). A list
showing both "Sleep" and "sleep" would be confusing, so the second attempt is a
`409`. Two *different* users may each have a "Sleep" folder.

Names are stored as entered — case is preserved, only uniqueness ignores it.

> **`public.folders` already exists on the deployed database.** It was created
> by hand rather than by a migration, with `(id, user_id, name, created_at)` and
> RLS enabled. Migration 018's `CREATE TABLE IF NOT EXISTS` is therefore a no-op
> there, so the migration adds what that table is missing — `updated_at`, the
> not-blank constraint, the indexes, the trigger, and the full policy set — as
> separate statements. On a clean database the `CREATE TABLE` runs and those
> statements are no-ops.
>
> Its existing policies were not created by a migration and so aren't knowable
> from this repo. 018 drops and recreates each policy *by name*, which
> normalizes the table onto a known set — but a hand-made policy under a
> different name would survive. **Check the dashboard for duplicate policies
> after applying.**

## 2. Privacy (RLS)

Both tables are **strictly private**. Unlike `item_reactions` (migration 016),
where counts are deliberately public, nothing here is readable by anyone but the
owner — a reading list is personal, and save counts are not a feature.

Every policy is scoped to `auth.uid() = user_id`, for all four operations. There
is no public-`SELECT` policy on either table.

Two extra checks matter beyond simple ownership:

- **INSERT and UPDATE on `saved_items` validate `folder_id` ownership.** The
  `WITH CHECK` requires that any folder being written belongs to the caller.
  Without this, a user could file an item into someone else's folder — which
  would confirm that folder id exists and leak its contents into their own
  library view.
- **`WITH CHECK` on folder UPDATE**, not just `USING`. `USING` picks which rows
  may be updated; `WITH CHECK` validates the result. Without the latter, a user
  could reassign one of their own folders to another `user_id`.

Enforcement is two-layered: each server action resolves the caller with
`getCurrentUser()` and scopes its query, *and* RLS restricts every operation in
the database. The second layer is the real guarantee — if a handler forgot to
scope a query, the database still would not return another user's rows.

Note `proxy.ts` guards `/admin` and `/api/admin` only. `/library` is in
`PROTECTED_ROUTES`, but that covers the page route, not `/api/library`, so every
route here checks auth for itself.

## 3. Endpoints

All require a session; every route returns `401` when unauthenticated.

### `POST /api/library/save`

```json
{ "item_id": "<uuid>", "folder_id": "<uuid>" | null }
```

`folder_id` is optional: omit to save unfiled (or to leave an already-saved item
where it is), pass an id to file it, pass `null` to unfile.

**Idempotent.** Saving an already-saved item returns `200` with the existing row
rather than a conflict — "saved" is a desired end state, not an increment.
`created` distinguishes the two, and is computed by an explicit existence check
rather than comparing `created_at`/`updated_at`, since the `BEFORE UPDATE`
trigger bumps `updated_at` even when the upsert changes nothing.

| Status | Meaning                                     |
| ------ | ------------------------------------------- |
| `201`  | Newly saved (`created: true`)               |
| `200`  | Already saved (`created: false`)            |
| `400`  | `item_id` missing/not a UUID, bad `folder_id` |
| `401`  | Not logged in                                |
| `404`  | No such item, or folder not owned by caller  |

### `POST /api/library/unsave`

```json
{ "item_id": "<uuid>" }
```

**Idempotent.** Unsaving something not saved returns `200` with
`removed: false`, not `404`: the requested end state — "this item is not in my
library" — holds either way, and a UI toggling a button off shouldn't have to
care which it was.

### `GET /api/library/saved`

| Param    | Default | Notes                                                        |
| -------- | ------- | ------------------------------------------------------------ |
| `folder` | all     | A folder UUID, or the literal `none` for unfiled items only.  |
| `limit`  | `50`    | Capped at 100.                                                |
| `offset` | `0`     | Pagination offset.                                            |

`folder=none` exists because a query string can't carry a real `null`, and
"unfiled only" is a genuinely different request from "no filter".

Response: `{ items, total, limit, offset }`. Each item is a `saved_items` row
with the content joined at `item` (including its `source`), so a library page
renders without a second request.

### `PATCH /api/library/saved` — move an item into a folder

```json
{ "item_id": "<uuid>", "folder_id": "<uuid>" | null }
```

This is the "link saved items to folders" operation. `folder_id: null` moves the
item back to unfiled. Unlike `POST /save`, `folder_id` is **required** here — a
move with no destination is meaningless, so omitting it is a `400` rather than a
silent no-op.

Identified by `item_id` rather than the saved row's `id`: a client rendering an
item knows the content id, and `(user_id, item_id)` is unique anyway.

Targeting a folder the caller doesn't own returns `404`, not `403` — a user
shouldn't be able to distinguish "someone else's folder" from "no such folder",
since that difference is itself information about another user's data.

### `POST /api/library/folders`

```json
{ "name": "Sleep" }
```

`201` on success, `409` when the name already exists for that user
(case-insensitively), `400` for blank or over-100-character names. Capped at
**200 folders per user** — a product limit, checked in the action rather than as
a database constraint.

### `GET /api/library/folders`

Response: `{ folders: [{ id, user_id, name, created_at, updated_at, item_count }], total }`

`item_count` is how many of the caller's saved items are filed in each folder.
It comes from one grouped read of the user's `saved_items`, so listing N folders
stays two round trips rather than N+1.

### `DELETE /api/library/folders?id=<uuid>`

Deletes a folder and **keeps its items**, which become unfiled. `404` when the
folder doesn't exist or isn't the caller's.

## 4. Tests

```bash
node scripts/test-library-logic.mjs   # 43 passed, 0 failed
node scripts/test-library.mjs         # 7 passed, 0 failed, 1 skipped
```

**[scripts/test-library-logic.mjs](../scripts/test-library-logic.mjs)** — 43
assertions against an in-memory stand-in enforcing the same constraints as the
real tables: unique `(user_id, item_id)`, case-insensitive per-user folder
names, `ON DELETE SET NULL` on folder deletion, and per-user scoping. Covers
save idempotency, unsave idempotency, folder name collisions (including case and
whitespace), filing and moving between folders, `item_count`, folder deletion
preserving contents, and a privacy section: one user's list excluding another's
rows, two users saving the same item independently, filing into another user's
folder being rejected on both save and move, one user's unsave not touching the
other's row, and deleting another user's folder failing.

**[scripts/test-library.mjs](../scripts/test-library.mjs)** — end-to-end against
a running server. The unauthenticated half passes today (**7 passed**): all
seven route/method combinations return `401`.

These tests earned their keep — they caught a real build error the typechecker
missed. `lib/actions/library.ts` is a `"use server"` file, and such a file may
only export async functions; the exported constants made every route return
`500`. `tsc --noEmit` passed clean, and only the Next.js compiler rejected it.
The constants now live in `lib/actions/libraryValidation.ts`, a plain module.

The authenticated half — save/re-save, list with join, folder create/list/delete,
moving between folders, `folder=none`, `item_count`, and the cross-user privacy
checks — is written and **skipped**: signing in needs a *confirmed* Supabase
user, and this project has email confirmation enabled with no service-role key
available locally, so a test account can't be minted from here. Supply
credentials and the whole suite runs:

```bash
TEST_USER_EMAIL=…  TEST_USER_PASSWORD=… \
TEST_USER2_EMAIL=… TEST_USER2_PASSWORD=… \
node scripts/test-library.mjs
```

Verified separately against the live database on the existing `folders` table:
anonymous `SELECT` returns 0 rows, `INSERT` is rejected with `42501`
(`new row violates row-level security policy`), and `UPDATE`/`DELETE` match
nothing — so the RLS shape this migration relies on is real, not assumed.

## 5. Applying the migration

There is no service-role key or database connection string in the local
environment, so **018 has not been applied** — run it via the Supabase dashboard
(SQL editor) or `supabase db push`. It is idempotent and safe to re-run.

Until it runs, `saved_items` does not exist and every save/unsave/list call will
fail. `folders` already exists, so the folder endpoints partly work — but
without `updated_at` the `GET` response omits that field, and the folder-name
uniqueness index isn't in place yet, so duplicate names would be accepted.
