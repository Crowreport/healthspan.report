# Saved Items — Model Proposal (Week 4 pairing draft)

**Status: draft for the Sukhman pairing session, not implemented.** This sketches a
starting point for `saved_items` so the pairing session has something concrete to
react to rather than a blank page. Nothing here is a migration yet — no table
has been created.

## 1. What this needs to support

A user can save a content item (article/video/podcast row in `rss_items`) for
later, the way `item_reactions` (migration 016) lets them react to one. This is
functionally a bookmark: does the current user have this item saved, and what
does their saved list look like.

## 2. Prior art already in the repo

`origin/Jonathan-Saved-Articles` (unmerged, predates the audience/reactions work)
already built a save feature: `saved_articles`, `folders`, `tags`, and an
`article_tags` join table, surfaced at `/my-articles`. Two things make it not a
drop-in fit today:

- It targets `public.articles`, a separate table from `public.rss_items`. Since
  then the content model has consolidated onto `rss_items` (see
  [audience-and-reactions-api.md](./audience-and-reactions-api.md)), so a new
  design should key off `rss_items.id` the same way `item_reactions` does.
- It ships folders and tags as v1. `item_reactions` shipped the minimal
  save/unsave-equivalent shape first (toggle a row) and added nothing
  speculative. Worth deciding deliberately whether folders/tags are in v1 or a
  follow-up — flagged as an open question below rather than assumed.

## 3. Proposed table (starting point, not final)

```sql
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  item_id UUID NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS saved_items_user_id_idx
  ON public.saved_items(user_id, created_at DESC);
```

Mirrors `item_reactions`' shape: composite primary key on `(item_id, user_id)`
makes "save" idempotent and "unsave" a delete, no separate boolean/state column
needed. Unlike `item_reactions`, there's only one relationship type here (saved
or not), so no third `reaction_type`-style column in the key.

`user_id, created_at DESC` index matches the read pattern a "My saved items"
page needs: this user's saves, most recent first.

## 4. Relationship to items and users

- `item_id → rss_items.id`, `ON DELETE CASCADE` — matches `item_reactions`;
  deleting an item should not leave orphaned saves.
- `user_id → public.users.id`, `ON DELETE CASCADE` — matches every other
  per-user table in this schema (`item_reactions`, `comments`).
- No relationship to `public.articles` — that table predates the RSS-item
  consolidation and new features are being built against `rss_items`.

## 5. RLS (draft)

Unlike reactions, a user's saved list is arguably private, not a public count —
worth confirming with Sukhman, but the working assumption is: SELECT/INSERT/
DELETE all scoped to `auth.uid() = user_id`, with no public-read policy the way
`item_reactions` has one for its counts.

## 6. API surface (draft, following the reactions route shape)

- `POST /api/items/{id}/saved` — save (idempotent upsert), auth required.
- `DELETE /api/items/{id}/saved` — unsave.
- `GET /api/items/{id}/saved` — is this item saved by the current user (for
  hydrating a bookmark icon's state on a card).
- `GET /api/users/me/saved-items` — the user's full saved list, paginated.

## 7. Open questions for the pairing session

1. Folders/tags in v1, or a bare save/unsave first (matching how reactions
   shipped minimal, then the API was built on top)?
2. Is the saved list private-only, or should save *counts* be public the way
   reaction counts are (e.g. "127 people saved this")?
3. Does `/my-articles` get rebuilt against `rss_items`, or does this ship
   API-only for now with no page yet?
4. Table name: task notes call it `saved_items`; confirm that's preferred over
   reusing/renaming `saved_articles` from the unmerged branch.
