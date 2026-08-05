-- Add audience targeting for men's/women's sections.
-- rss_sources.audience is the per-source default; ingestion copies it onto
-- new rss_items rows. rss_items.audience is nullable and remains the
-- source of truth read by filters (a source's default can change later
-- without silently reclassifying items already ingested).
-- Both columns are nullable for backwards compat: existing rows/sources
-- with no audience are treated as unclassified/general.

ALTER TABLE public.rss_sources
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) CHECK (audience IN ('men', 'women', 'general'));

ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) CHECK (audience IN ('men', 'women', 'general'));

CREATE INDEX IF NOT EXISTS rss_items_audience_idx ON public.rss_items(audience);
