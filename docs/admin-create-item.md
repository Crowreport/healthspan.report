# Admin "Create Item" — Backend Contract

Week 1 deliverable. Backend for manually adding a story/item is live at
`POST /api/admin/items`. This doc defines the form fields so the UI can be
built around them.

## Endpoint

```
POST /api/admin/items
Content-Type: application/json
```

Auth: caller must be logged in (Supabase session cookie) and have
`role = 'admin'` in `public.users`. Non-admins get `403`, anonymous gets `401`.

## Form fields

| Field          | Type    | Required | Default     | Notes                                                                    |
| -------------- | ------- | -------- | ----------- | ------------------------------------------------------------------------ |
| `source_url`   | string  | yes      | —           | Where the content lives. Must be a valid http(s) URL, max 500 chars. Also used for dedup — the same URL can't be added twice for the same content type. |
| `headline`     | string  | yes      | —           | Title shown on cards. Max 500 chars.                                     |
| `teaser`       | string  | no       | `""`        | Short summary/description shown under the headline.                     |
| `tag`          | string  | no       | `null`      | Topical label (e.g. "Sleep", "Supplements"). Max 100 chars.              |
| `featured`     | boolean | no       | `false`     | `true` = surface in Top News / featured slots (`rss_items.is_featured`). |
| `source_type`  | string  | no       | `"curated"` | `curated` = added by hand, `feed` = came from a feed. The form should default to `curated`. |
| `content_type` | string  | no       | `"article"` | One of `article`, `video`, `podcast`, `topic`, `research`. Controls which page/section lists the item. |

## Example request

```bash
curl -X POST https://<host>/api/admin/items \
  -H "Content-Type: application/json" \
  --cookie "<supabase auth cookies>" \
  -d '{
    "source_url": "https://example.com/great-longevity-story",
    "headline": "New study links VO2 max to healthspan",
    "teaser": "A 20-year cohort study finds cardio fitness is the strongest predictor.",
    "tag": "Exercise",
    "featured": true,
    "content_type": "article"
  }'
```

## Responses

| Status | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| `201`  | Created. Body: `{ "item": { ...rss_items row } }`               |
| `400`  | Validation failed. Body: `{ "error", "details": [messages] }`  |
| `401`  | Not logged in                                                   |
| `403`  | Logged in but not admin                                         |
| `409`  | An item with this `source_url` already exists                   |
| `500`  | Server/database error                                           |

## How it works under the hood

- Items are stored in `rss_items`. Every item belongs to a source
  (`rss_sources`); admin-created items attach to an internal "curated" source
  per content type (`internal://curated/<type>`, seeded by migration 015), so
  all existing type-filtered page queries pick them up with no query changes.
- `rss_items.source_type` distinguishes `curated` vs `feed` rows; all
  pre-existing ingested rows were backfilled to `feed`.
- `published_at` is set to the creation time; `slug` is generated from the
  headline; `guid` is the `source_url` (dedup key per source).
- The endpoint revalidates `/` plus the page for the item's content type, so
  new items appear immediately.
