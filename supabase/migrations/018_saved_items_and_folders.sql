-- Week 4: save/bookmark + folders (collections).
--
-- Two tables:
--   public.folders     — user-owned collections, named by the user
--   public.saved_items — a user's bookmark of an rss_items row, optionally
--                        filed into one of their folders
--
-- Both are strictly private: RLS restricts every operation to rows owned by
-- auth.uid(). Unlike item_reactions (migration 016), where counts are public,
-- nothing here is readable by anyone but the owner — a reading list is personal.
--
-- Idempotent throughout: CREATE TABLE / CREATE INDEX IF NOT EXISTS, and
-- DROP POLICY IF EXISTS before each CREATE POLICY.
--
-- NOTE: public.folders already exists on the deployed database, created by hand
-- rather than by a migration, with columns (id, user_id, name, created_at) and
-- RLS enabled. CREATE TABLE IF NOT EXISTS therefore does nothing there, so the
-- statements below add what that table is missing (updated_at, the constraint,
-- the indexes, the full policy set) separately instead of assuming a fresh
-- create. On a clean database the CREATE TABLE runs and the ADD COLUMN /
-- CREATE INDEX statements are no-ops.

-- ---------------------------------------------------------------------------
-- 1. Folders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The hand-created table has no updated_at, and the trigger below needs it.
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- A folder name must not be blank or whitespace-only. Added separately so it
-- also lands on the pre-existing table.
ALTER TABLE public.folders
  DROP CONSTRAINT IF EXISTS folders_name_not_blank;
ALTER TABLE public.folders
  ADD CONSTRAINT folders_name_not_blank CHECK (length(btrim(name)) > 0);

COMMENT ON TABLE public.folders IS
  'User-owned collections for filing saved items. Private to the owner.';

-- Case-insensitive per-user name uniqueness: "Sleep" and "sleep" would be
-- confusing to see side by side in a folder list, so treat them as one name.
CREATE UNIQUE INDEX IF NOT EXISTS folders_user_name_unique_idx
  ON public.folders (user_id, lower(btrim(name)));

-- "List my folders", the main read.
CREATE INDEX IF NOT EXISTS folders_user_id_created_idx
  ON public.folders (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Folders are private: every operation is scoped to the owner. There is no
-- public-read policy, unlike reactions — a collection name is personal.
--
-- The pre-existing table already has RLS on with at least an INSERT policy, but
-- its exact policy set was not created by a migration and so is not knowable
-- from this repo. Each policy below is dropped by name and recreated, which
-- normalizes the deployed table onto a known set. Any hand-made policy under a
-- different name survives — check the dashboard for duplicates after applying.
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders"
  ON public.folders
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
CREATE POLICY "Users can create their own folders"
  ON public.folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- USING picks which rows may be updated; WITH CHECK validates the result, so a
-- user cannot reassign one of their folders to someone else.
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
CREATE POLICY "Users can update their own folders"
  ON public.folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can delete their own folders"
  ON public.folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Saved items
-- ---------------------------------------------------------------------------

-- Cardinality: one row per (user_id, item_id) — saving is a boolean, not a
-- counter, so a user either has an item saved or does not. Enforced by the
-- unique index below rather than a composite primary key, because `id` is a
-- more convenient handle for a client that wants to move or unsave a specific
-- saved row.
--
-- folder_id is nullable and means "saved but not filed" — the default landing
-- state. ON DELETE SET NULL so deleting a folder returns its contents to
-- unfiled rather than destroying the user's bookmarks.
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.saved_items IS
  'A user''s saved/bookmarked items. One row per (user_id, item_id); folder_id NULL means saved but unfiled. Private to the owner.';
COMMENT ON COLUMN public.saved_items.folder_id IS
  'Optional folder. NULL = unfiled. ON DELETE SET NULL: removing a folder unfiles its items rather than deleting them.';

-- An item is either saved or not: one row per user per item.
CREATE UNIQUE INDEX IF NOT EXISTS saved_items_user_item_unique_idx
  ON public.saved_items (user_id, item_id);

-- "List my saved items, newest first" — the main read path.
CREATE INDEX IF NOT EXISTS saved_items_user_created_idx
  ON public.saved_items (user_id, created_at DESC);

-- "List what's in this folder". Partial: unfiled rows are served by the index
-- above, so there is no reason to index their NULL folder_id.
CREATE INDEX IF NOT EXISTS saved_items_folder_idx
  ON public.saved_items (folder_id, created_at DESC)
  WHERE folder_id IS NOT NULL;

-- "Is this item saved?" when rendering an item without a user-scoped query.
CREATE INDEX IF NOT EXISTS saved_items_item_id_idx
  ON public.saved_items (item_id);

DROP TRIGGER IF EXISTS update_saved_items_updated_at ON public.saved_items;
CREATE TRIGGER update_saved_items_updated_at
  BEFORE UPDATE ON public.saved_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- Saved items are private. No public SELECT policy: save counts are not a
-- feature, and exposing them would leak reading habits.
DROP POLICY IF EXISTS "Users can view their own saved items" ON public.saved_items;
CREATE POLICY "Users can view their own saved items"
  ON public.saved_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- On insert, both the row's owner and any folder it is filed into must belong
-- to the caller — otherwise a user could file an item into someone else's
-- folder, which would leak that folder's id and contents.
DROP POLICY IF EXISTS "Users can create their own saved items" ON public.saved_items;
CREATE POLICY "Users can create their own saved items"
  ON public.saved_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      folder_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = saved_items.folder_id AND f.user_id = auth.uid()
      )
    )
  );

-- Moving an item between folders is an UPDATE of folder_id. The same
-- folder-ownership check applies, so a move cannot target a folder the caller
-- does not own.
DROP POLICY IF EXISTS "Users can update their own saved items" ON public.saved_items;
CREATE POLICY "Users can update their own saved items"
  ON public.saved_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      folder_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.id = saved_items.folder_id AND f.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own saved items" ON public.saved_items;
CREATE POLICY "Users can delete their own saved items"
  ON public.saved_items
  FOR DELETE
  USING (auth.uid() = user_id);
