# Top News + Reactions — Week 2 Backend

Covers the featured-driven Top News block and the reactions data model.

## 1. Top News selection

`getTopNewsItems()` in [lib/content/topNews.ts](../lib/content/topNews.ts) is the
single source of truth for what appears in the Top News block.

**Eligibility.** An item is eligible when `rss_items.is_featured = true` and
`hidden_by_admin = false`. Nothing else surfaces — recency alone never promotes
an item into the block.

**Ordering.**

1. `featured_priority ASC`, with `NULL` sorted last
2. `published_at DESC` as the tie-break, and the whole order for unranked items

An admin who only ticks **featured** gets pure recency ordering. Setting
`featured_priority` pins specific stories above newer ones (lower = higher;
`0` beats `1`).

**Shape.** The result splits into `hero` (rank 1) and `items` (ranks 2–6):
1 hero + 5 list items by default, capped at `TOP_NEWS_MAX_LIMIT = 20`.

## 2. Endpoint

```
GET /api/top-news?limit=6&type=article
```

| Param   | Required | Default | Notes                                                       |
| ------- | -------- | ------- | ----------------------------------------------------------- |
| `limit` | no       | `6`     | Total across hero + list. Positive integer, capped at 20.     |
| `type`  | no       | all     | One of `article`, `video`, `podcast`, `topic`, `research`.    |

Response:

```json
{
  "hero": {
    "id": "…", "headline": "…", "teaser": "…", "slug": "…",
    "imageUrl": "…", "externalUrl": "…", "publishedAt": "…",
    "sourceName": "…", "tags": ["Sleep"], "contentType": "article", "rank": 1
  },
  "items": [ /* same shape, rank 2..n */ ],
  "total": 6
}
```

Only presentation fields are returned. Internal columns (`guid`, `source_id`,
`content`, `extracted_content`, `hidden_by_admin`, …) are never exposed.

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| `200`  | OK. `hero` is `null` when nothing is featured. |
| `400`  | Invalid `limit` or `type`                      |
| `500`  | Database error                                 |

The homepage falls back to the most recent articles when nothing is featured
yet, so the block is never blank.

## 3. QA — 10 admin-created items

Migration `016` must be applied first. Create 10 items with the Week 1 tool
([docs/admin-create-item.md](./admin-create-item.md)), marking some featured:

```bash
for i in $(seq 1 10); do
  curl -X POST http://localhost:3000/api/admin/items \
    -H "Content-Type: application/json" \
    --cookie "<supabase auth cookies>" \
    -d "{\"source_url\":\"https://example.com/qa-$i\",
         \"headline\":\"QA item $i\",
         \"teaser\":\"Week 2 Top News QA item $i\",
         \"tag\":\"Sleep\",
         \"featured\":$([ $((i % 2)) -eq 0 ] && echo true || echo false)}"
done
```

Then confirm:

1. `GET /api/top-news` returns only the 5 featured items — the unfeatured 5 never appear.
2. `hero` is the most recently published featured item; `items` follow in recency order with `rank` 2..n.
3. Featuring an 11th item makes it the new hero (it is the newest).
4. Setting `featured_priority = 0` on any featured item pins it to the hero slot regardless of date.
5. Un-featuring the hero promotes the next item and re-ranks the block.
6. Setting `hidden_by_admin = true` removes an item even while `is_featured = true`.
7. With every item unfeatured, `hero` is `null`, `items` is `[]`, `total` is `0`.

The ranking rules are also covered by an executable harness of these cases
(hero/list split, priority pinning, hidden exclusion, empty state, tie-breaks).

## 4. Reactions data model

Table `public.item_reactions` (migration `016`). This is **distinct from**
`public.comment_reactions` (migration `012`), which reacts to *comments*;
this one reacts to *content items*.

| Column          | Type          | Notes                                          |
| --------------- | ------------- | ---------------------------------------------- |
| `id`            | `UUID`        | Surrogate key, `UNIQUE`, defaults to `gen_random_uuid()` |
| `item_id`       | `UUID`        | → `rss_items(id)` `ON DELETE CASCADE`           |
| `user_id`       | `UUID`        | → `users(id)` `ON DELETE CASCADE`               |
| `reaction_type` | `VARCHAR(20)` | `thumbs_up` \| `insightful` \| `favorite`       |
| `created_at`    | `TIMESTAMPTZ` | Defaults to `NOW()`                             |

**Cardinality decision — one row per `(item_id, user_id, reaction_type)`,
enforced by the composite primary key.**

A user may hold several *different* reactions on the same item at once (e.g.
both `insightful` and `favorite`) but cannot apply the same reaction twice.

The alternative — one reaction per user per item, where choosing a new type
replaces the old — was rejected because these types are not mutually exclusive
in meaning: `favorite` is a save-for-later signal while `insightful` is a
quality signal, and forcing a choice between them loses information.

Because `reaction_type` is part of the primary key, changing a reaction is a
delete + insert rather than an in-place update; there is deliberately no
`UPDATE` policy. Toggling a reaction off is a `DELETE` of that one row.

**RLS.** Anyone may read (counts are public). Authenticated users may insert
and delete only rows where `user_id = auth.uid()`.

Server actions live in [lib/actions/reactions.ts](../lib/actions/reactions.ts):
`getItemReactions` (counts + the caller's own reactions), `addItemReaction`
(idempotent), and `removeItemReaction`.

## 5. Migration

`supabase/migrations/016_top_news_priority_and_item_reactions.sql` adds
`rss_items.featured_priority` and creates `item_reactions`.

Both changes are additive and safe to re-run: the column is `ADD COLUMN IF NOT
EXISTS` defaulting to `NULL`, so every existing featured row keeps its current
recency-only ordering. `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
EXISTS`, and `DROP POLICY IF EXISTS` before each `CREATE POLICY` make the
migration idempotent. No backfill or data rewrite is performed.

A partial index (`rss_items_top_news_idx`) covers exactly the Top News query:
featured, visible items ordered by `(featured_priority, published_at)`.
