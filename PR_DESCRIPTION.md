# PR: DB-backed articles, RSS ingestion, and inline admin edit

## Summary

Articles and home-page content are now served from the database only. RSS feeds are ingested on a schedule; admins can edit, hide, reset, or delete articles directly from the articles and home pages via an edit modal (no separate admin dashboard).

---

## What changed

### Content & data flow

- **Articles and home** read from the DB only (`rss_items` + `rss_sources`). No direct RSS fetch on page load.
- **Modular content layer** (`lib/content/articles.ts`): `getArticlesFromDB()`, `mapRSSItemToArticle()` for articles; extensible to other types (e.g. videos) later.
- **RSS ingestion** runs every **3 hours** (Vercel Cron → `/api/rss/ingest`). Inserts **new** items only (dedup by `source_id` + `guid`); existing rows are not overwritten by the cron.

### Admin editing (inline, no dashboard)

- **Edit** button on each article card (articles page and home “Latest Research”) when the user is an admin.
- Clicking Edit opens a **modal** to change:
  - Title, excerpt, thumbnail URL
  - **Hidden from public** (soft-hide; reversible)
- Modal actions: **Save**, **Reset from RSS** (refetch from feed and revert edits), **Delete** (remove from DB), **Cancel**.
- Removed the old admin dashboard (`/admin`, `/admin/articles`) and related components.

### Database & types

- **Migration 011** (`hidden_by_admin`): adds column, RLS so the public doesn’t see hidden items and only admins can update/delete.
- **Types**: `DBRSSItem.hidden_by_admin`, `UpdateRSSItemInput`; server actions use these for admin updates.

### API & cron

- **`/api/rss/fill`** (GET/POST): one-shot seed + ingest to populate the DB.
- **`/api/rss/ingest`**: used by cron; also supports optional body (e.g. `contentTypes`, `maxItemsPerSource`).
- **`vercel.json`**: cron schedule set to `0 */3 * * *` (every 3 hours).

### Auth

- **`lib/auth.ts`**: `getCurrentUser()`, `requireAdmin()` (used to show Edit only to admins).

---

## New files

| Path | Purpose |
|------|--------|
| `lib/content/articles.ts` | `getArticlesFromDB()`, `mapRSSItemToArticle()` |
| `lib/auth.ts` | `getCurrentUser()`, `requireAdmin()` |
| `app/api/rss/fill/route.ts` | One-shot seed + ingest |
| `components/articles/EditArticleModal.tsx` | Modal: edit, reset from RSS, delete |
| `components/articles/ArticlesGridWithEdit.tsx` | Articles page grid + Edit + modal |
| `APPLY_MIGRATION_011.md` | How to run migration 011 (e.g. Supabase SQL Editor) |

---

## Removed / no longer used

- `app/admin/` (layout, page, articles page, `AdminArticlesClient.tsx`)
- `components/admin/AdminArticlesLink.tsx`

---

## How to test

1. **Apply migration 011** in Supabase (see `APPLY_MIGRATION_011.md`) so `hidden_by_admin` exists.
2. **Fill DB once**: `POST /api/rss/fill` (or open in browser in dev).
3. **Articles page & home**: content should load from DB; as an admin, “Edit” on a card opens the modal.
4. **Cron**: after deploy, Vercel Cron will hit `/api/rss/ingest` every 3 hours.

---

## Checklist

- [ ] Migration 011 applied in target environment
- [ ] `CRON_SECRET` set in Vercel (optional; used for manual/external ingest calls)
- [ ] Admin user has `role = 'admin'` in `public.users` to see Edit
