-- Add soft-delete for RSS items; restrict updates to admins.
-- Ingestion already uses "insert only" (ignoreDuplicates: true), so existing rows are never overwritten by the feed.
-- Admins can edit title/excerpt/thumbnail and hide items.

ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT false;

-- Public sees only non-hidden items from active sources
DROP POLICY IF EXISTS "RSS items from active sources are viewable by everyone" ON public.rss_items;
CREATE POLICY "RSS items from active sources are viewable by everyone"
  ON public.rss_items
  FOR SELECT
  USING (
    (hidden_by_admin IS NOT TRUE)
    AND EXISTS (
      SELECT 1 FROM public.rss_sources
      WHERE id = rss_items.source_id AND is_active = true
    )
  );

-- Only admins can update (edit title/excerpt/thumbnail or set hidden)
DROP POLICY IF EXISTS "Service can update RSS items" ON public.rss_items;
CREATE POLICY "Admins can update RSS items"
  ON public.rss_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS rss_items_hidden_by_admin_idx ON public.rss_items(hidden_by_admin) WHERE hidden_by_admin = false;
