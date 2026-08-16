-- Week 2: Top News ordering + reactions on content items.
--
-- 1. Add rss_items.featured_priority so admins can hand-rank the Top News block
--    instead of relying purely on recency.
-- 2. Add public.item_reactions — reactions on content items (articles/videos),
--    distinct from public.comment_reactions in migration 012, which reacts to
--    *comments*. Both tables coexist; this one hangs off rss_items.

-- ---------------------------------------------------------------------------
-- 1. Top News priority
-- ---------------------------------------------------------------------------

-- Manual rank for featured items. Lower number = higher up in Top News.
-- NULL means "unranked": those fall below all hand-ranked items and are then
-- ordered by published_at DESC. Default NULL keeps every existing featured row
-- behaving exactly as it does today (pure recency ordering).
ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS featured_priority INTEGER;

COMMENT ON COLUMN public.rss_items.featured_priority IS
  'Manual Top News rank for featured items. Lower = higher placement. NULL = unranked, ordered by published_at DESC after ranked items.';

-- Partial index covering exactly the Top News query: featured, visible items
-- ordered by (priority, recency).
CREATE INDEX IF NOT EXISTS rss_items_top_news_idx
  ON public.rss_items (featured_priority ASC NULLS LAST, published_at DESC)
  WHERE is_featured = true AND hidden_by_admin = false;

-- ---------------------------------------------------------------------------
-- 2. Reactions on content items
-- ---------------------------------------------------------------------------

-- Cardinality decision: ONE ROW PER (item, user, reaction_type).
--
-- A user may hold several *different* reactions on the same item at once
-- (e.g. both 'insightful' and 'favorite') but cannot apply the same reaction
-- twice. This is enforced by the composite primary key below.
--
-- The alternative — one reaction per user per item, where picking a new type
-- replaces the old — was rejected because these types are not mutually
-- exclusive in meaning: 'favorite' is a save-for-later signal while
-- 'insightful' is a quality signal, and forcing a user to choose loses data.
-- Toggling a reaction off is a DELETE of that one row.
CREATE TABLE IF NOT EXISTS public.item_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  item_id UUID NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL
    CHECK (reaction_type IN ('thumbs_up', 'insightful', 'favorite')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, user_id, reaction_type)
);

COMMENT ON TABLE public.item_reactions IS
  'Reactions on content items (rss_items). One row per (item, user, reaction_type): a user may hold multiple distinct reaction types on the same item, but not the same type twice.';

-- Counting reactions for an item is the hot read path.
CREATE INDEX IF NOT EXISTS item_reactions_item_id_idx
  ON public.item_reactions(item_id);
-- "What has this user reacted to" — used to hydrate reaction state in the UI.
CREATE INDEX IF NOT EXISTS item_reactions_user_id_idx
  ON public.item_reactions(user_id);
CREATE INDEX IF NOT EXISTS item_reactions_created_at_idx
  ON public.item_reactions(created_at DESC);

ALTER TABLE public.item_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions (public counts).
DROP POLICY IF EXISTS "Item reactions are viewable by everyone" ON public.item_reactions;
CREATE POLICY "Item reactions are viewable by everyone"
  ON public.item_reactions
  FOR SELECT
  USING (true);

-- Authenticated users may only create reactions attributed to themselves.
DROP POLICY IF EXISTS "Users can create their own item reactions" ON public.item_reactions;
CREATE POLICY "Users can create their own item reactions"
  ON public.item_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Removing a reaction (the toggle-off path) is a delete of the user's own row.
DROP POLICY IF EXISTS "Users can delete their own item reactions" ON public.item_reactions;
CREATE POLICY "Users can delete their own item reactions"
  ON public.item_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy: reaction_type is part of the primary key, so changing a
-- reaction is modelled as delete + insert rather than an in-place update.
