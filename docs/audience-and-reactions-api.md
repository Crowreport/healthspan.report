# Audience + Reactions API — Week 3 Backend

Covers the `audience` dimension on content items, the new general-health
sources, and the REST reactions API.

Migration: `supabase/migrations/017_item_audience_and_general_health_sources.sql`

## 1. Audience

`rss_items.audience` and `rss_sources.audience` classify content as
`general` | `women` | `men`.

**Where it comes from.** Audience is a property of the *outlet*: everything
Women's Health publishes is women's-health content. So the audience lives on the
source, and ingestion stamps it onto each item as the item is written
(`audienceForSource()` in [lib/rss/ingestionService.ts](../lib/rss/ingestionService.ts)).

Copying it onto the item rather than joining back to the source at read time
means two things:

- item queries filter on one column with no join
- changing a source's audience later does **not** silently reclassify items
  already ingested, and an admin can override a single item without affecting
  the rest of the feed

**`general` is the default.** Nearly all content applies to everyone, so
`general` is the column default and the value every pre-existing row was
migrated to.

### Change from the earlier nullable column

The men's/women's section work added `audience` as a **nullable** column on both
tables. That left two representations of the same idea — `NULL`
("unclassified") and `'general'` — which every reader had to collapse for
itself. Migration 017 backfills `NULL → 'general'` and sets
`NOT NULL DEFAULT 'general'`, so there is exactly one way to say "applies to
everyone". The `CHECK` constraints are recreated under known names
(`rss_items_audience_check`, `rss_sources_audience_check`) so the migration is
re-runnable.

The column keeps the name `audience` on both tables — matching the existing
branch rather than introducing a parallel `default_audience`.

### Filtering

```
GET /api/rss/items?audience=women&limit=20
```

| Param      | Required | Default      | Notes                                  |
| ---------- | -------- | ------------ | -------------------------------------- |
| `audience` | no       | all audiences | One of `general`, `women`, `men`. Invalid values → `400`. |

Omitting `audience` returns every audience, so existing callers and the mixed
homepage feed are unchanged.

`POST /api/admin/items` also accepts an optional `audience` field
(default `general`) — see [docs/admin-create-item.md](./admin-create-item.md).

Index: `rss_items_audience_published_idx` on `(audience, published_at DESC)` —
audience is always queried alongside recency ("latest women's health").

## 2. General health sources

Six sources broaden coverage past the longevity specialists and give the
men's/women's sections real content. All are standard RSS, so the existing
regular-feed ingestion path handles them with no new code.

| Source                     | Type     | Audience  |
| -------------------------- | -------- | --------- |
| Healthline                 | article  | general   |
| ScienceDaily Health        | article  | general   |
| National Institute on Aging | research | general   |
| Prevention                 | article  | general   |
| Men's Health               | article  | men       |
| Women's Health             | article  | women     |

**Every URL was fetched and parsed before being added.** Three outlets from the
original shortlist were dropped because their documented feeds are dead:

| Rejected        | URL tried                                            | Result             |
| --------------- | ---------------------------------------------------- | ------------------ |
| WebMD           | `rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC` | connection failure |
| Harvard Health  | `health.harvard.edu/blog/feed`                        | `404`              |
| Everyday Health | `everydayhealth.com/rss/all.xml`                      | `404`              |

ScienceDaily and NIA stand in as the general-health and aging-research sources.
Cleveland Clinic, Mayo Clinic, NIH, Medical News Today and Verywell were also
probed and returned `403`/`402`/`404`.

Note: NIA publishes infrequently — its newest item at time of writing is from
February 2026. It is included for authoritative aging research, not recency.

Sources are declared in [data/feeds.json](../data/feeds.json) and inserted by
migration 017. The seeder (`seedRSSSources`) uses `ignoreDuplicates: true`, so an
existing source is never overwritten; it now issues a follow-up `UPDATE` for
`audience` only, so a feed reclassified in `feeds.json` is picked up without
resetting fetch counters.

## 3. Reactions API

Backed by `public.item_reactions` (migration 016). One row per
`(item_id, user_id, reaction_type)`: a user may hold several *different*
reactions on one item (e.g. `insightful` **and** `favorite`) but never the same
type twice. Reaction types: `thumbs_up`, `insightful`, `favorite`.

### GET /api/items/{id}/reactions

Public — counts are visible to anonymous visitors.

```json
{
  "item_id": "d17735e5-…",
  "counts": { "thumbs_up": 12, "insightful": 5, "favorite": 3 },
  "userReactions": ["thumbs_up"],
  "total": 20
}
```

`userReactions` is the *caller's own* reactions, and is always `[]` when
anonymous.

| Status | Meaning                    |
| ------ | -------------------------- |
| `200`  | OK                         |
| `400`  | `id` is not a UUID         |
| `500`  | Database error             |

### POST /api/items/{id}/reactions

Requires a logged-in user.

```json
{ "reaction_type": "thumbs_up", "action": "toggle" }
```

| Field           | Required | Default    | Notes                                            |
| --------------- | -------- | ---------- | ------------------------------------------------ |
| `reaction_type` | yes      | —          | `thumbs_up` \| `insightful` \| `favorite`         |
| `action`        | no       | `"toggle"` | `toggle` \| `add` \| `remove`                     |

`toggle` adds the reaction if the user doesn't hold it and removes it if they
do — this is what a reaction button does. `add` and `remove` are explicit
one-way variants for clients that already know the desired end state; `add` is
idempotent and never removes.

The response carries the post-write counts, so a client needs **one** round trip
per tap rather than a POST followed by a GET:

```json
{
  "item_id": "d17735e5-…",
  "reaction_type": "thumbs_up",
  "reacted": true,
  "counts": { "thumbs_up": 13, "insightful": 5, "favorite": 3 },
  "userReactions": ["thumbs_up"],
  "total": 21
}
```

| Status | Meaning                                            |
| ------ | -------------------------------------------------- |
| `200`  | OK. `reacted` says which way the toggle went.      |
| `400`  | Bad `id`, `reaction_type`, `action`, or JSON body  |
| `401`  | Not logged in                                       |
| `404`  | No item with that id                                |
| `500`  | Database error                                      |

### Auth

Two independent layers:

1. The route returns `401` before touching the database when there is no
   session.
2. RLS pins every row to `auth.uid()` — a request cannot insert or delete a
   reaction on another user's behalf even if the handler were bypassed.

Note that `proxy.ts` only guards `/admin` and `/api/admin`, so this route does
its own auth check rather than relying on middleware.

The `404` check exists because a reaction on a nonexistent item would otherwise
fail on the foreign key and surface as a `500`. If that existence check itself
errors, the request proceeds and lets the write report the real failure rather
than returning a misleading `404`.

### Toggling and concurrency

`toggleItemReaction` reads current state, then writes — it needs the prior state
to pick a direction, so it can't be a single upsert. A concurrent double-tap can
interleave, but the primary key makes duplicate rows impossible; the losing
insert gets `23505`, which is swallowed because the row then exists, which is
what the caller wanted. Worst case the reaction lands in the state of whichever
request finished last.

There is deliberately no `UPDATE` policy on the table: `reaction_type` is part
of the primary key, so changing a reaction is delete + insert.

## 4. Tests

Two harnesses, both runnable with plain `node`:

```bash
node scripts/test-reaction-counts.mjs     # logic — no server or DB needed
node scripts/test-reactions.mjs           # API — needs a dev server
```

**[scripts/test-reaction-counts.mjs](../scripts/test-reaction-counts.mjs)** — 26
assertions over count aggregation and toggle direction, run against an in-memory
stand-in that enforces the same `(item_id, user_id, reaction_type)` primary key
as the real table. Covers: insert and retrieval, multi-user counts, one user
holding all three types, repeated `add` not double-counting, duplicate insert
raising `23505`, toggle direction, one type not disturbing another, one user's
removal not affecting another's, per-item isolation, and racing inserts
converging on a single row. **26 passed, 0 failed.**

**[scripts/test-reactions.mjs](../scripts/test-reactions.mjs)** — end-to-end
against a running server. The unauthenticated half passes today (**5 passed**):
GET is public, returns all three counts, returns no `userReactions` when
anonymous, POST without auth is `401`, malformed id is `400`.

The authenticated half — insert, retrieval across requests, coexisting types,
idempotent add, toggle off, two-user aggregation, and a mean-GET-latency
assertion — is written and **skipped** for now: signing in needs a
**confirmed** Supabase user, and this project has email confirmation enabled
with no service-role key available locally, so a test account can't be minted
from here. Supply credentials and the whole suite runs:

```bash
TEST_USER_EMAIL=…  TEST_USER_PASSWORD=… \
TEST_USER2_EMAIL=… TEST_USER2_PASSWORD=… \
node scripts/test-reactions.mjs
```

Verified separately against the live database: an anonymous insert into
`item_reactions` is rejected by RLS with `42501`
(`new row violates row-level security policy`), confirming the write policies
are active.

## 5. Applying the migration

There is no service-role key or database connection string in the local
environment, so **017 has not been applied** — run it via the Supabase
dashboard (SQL editor) or `supabase db push`. It is idempotent and safe to
re-run. Until it runs:

- `rss_items.audience` stays nullable with `NULL` rows, so
  `?audience=general` will not match them
- the six new sources are absent, so no general-health content is ingested

After applying, re-seed and ingest:

```bash
curl -X POST http://localhost:3000/api/rss/seed
curl -X POST http://localhost:3000/api/rss/ingest
```
