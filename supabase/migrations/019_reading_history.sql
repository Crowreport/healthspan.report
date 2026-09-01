-- Week 5: reading history.
--
-- public.reading_history — one row per (user_id, item_id) recording when the
-- user last opened that item.
--
-- CARDINALITY DECISION: one row per (user, item), not one row per view.
--
-- An append-only view log was rejected. The product read is "recently read,
-- newest first, no duplicates" — with an append-only table that becomes a
-- DISTINCT ON / GROUP BY over a table that grows without bound for every
-- scroll-past and every accidental double-open. Collapsing to one row per pair
-- makes the read a plain indexed ORDER BY, keeps the table proportional to
-- (users x items they've actually read), and makes the debounce enforceable in
-- one statement. `view_count` retains the "how often" signal that the log
-- would have carried, so nothing analytically useful is lost.
--
-- Re-reading an item moves it to the top of the list rather than adding a
-- second entry, which is what a reader expects from a history view.
--
-- Strictly private: RLS restricts every operation to auth.uid(), matching
-- saved_items in migration 018. A reading history is more sensitive than a
-- bookmark list, so there is no public-read policy of any kind.
--
-- Idempotent throughout: CREATE ... IF NOT EXISTS and DROP POLICY IF EXISTS
-- before each CREATE POLICY.

CREATE TABLE IF NOT EXISTS public.reading_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  -- Last time the user opened this item. Named viewed_at (not updated_at) so
  -- it is unambiguous that it tracks a user action, not a row mutation.
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- How many debounce-accepted opens have been recorded. Preserves the "read
  -- it three times" signal that a one-row-per-pair table would otherwise lose.
  view_count INTEGER NOT NULL DEFAULT 1 CHECK (view_count > 0),
  -- First open, for "you first read this in March" and retention analysis.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.reading_history IS
  'Per-user reading history. One row per (user_id, item_id); viewed_at is the most recent open and view_count the number of debounce-accepted opens. Private to the owner.';
COMMENT ON COLUMN public.reading_history.viewed_at IS
  'Most recent view. Re-reading updates this in place, moving the item to the top of the history list rather than inserting a duplicate row.';
COMMENT ON COLUMN public.reading_history.view_count IS
  'Number of views that passed the application-level debounce window. Not a raw page-load count.';

-- One row per user per item — the upsert conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS reading_history_user_item_unique_idx
  ON public.reading_history (user_id, item_id);

-- "My recent reads, newest first" — the main read path for GET /library/history.
CREATE INDEX IF NOT EXISTS reading_history_user_viewed_idx
  ON public.reading_history (user_id, viewed_at DESC);

-- Deliberately NO update_updated_at_column trigger here, unlike folders and
-- saved_items. viewed_at is set explicitly by the writer so that a debounced
-- write can leave it untouched; a BEFORE UPDATE trigger bumping a timestamp
-- would defeat that.

ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

-- A reading history is private. Four owner-scoped policies, no public read.
DROP POLICY IF EXISTS "Users can view their own reading history" ON public.reading_history;
CREATE POLICY "Users can view their own reading history"
  ON public.reading_history
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can record their own reading history" ON public.reading_history;
CREATE POLICY "Users can record their own reading history"
  ON public.reading_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- The upsert path takes the UPDATE branch on conflict, so this policy is
-- required for tracking to work at all, not just for edits.
DROP POLICY IF EXISTS "Users can update their own reading history" ON public.reading_history;
CREATE POLICY "Users can update their own reading history"
  ON public.reading_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- "Clear my history" / "remove this entry" — a reader must be able to forget.
DROP POLICY IF EXISTS "Users can delete their own reading history" ON public.reading_history;
CREATE POLICY "Users can delete their own reading history"
  ON public.reading_history
  FOR DELETE
  USING (auth.uid() = user_id);
