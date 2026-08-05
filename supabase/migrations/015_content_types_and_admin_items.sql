-- Week 1: content-type cleanup + admin curated items
--
-- 1. Widen rss_sources.content_type to include 'podcast' and 'research'.
--    feeds.json already declares Nature Aging as 'research', but the old CHECK
--    constraint only allowed ('article','video','topic'), so that source could
--    never be seeded and the Research page fell back to 'topic' blog posts.
-- 2. Add source_type ('curated' | 'feed') and tag to rss_items.
-- 3. Create internal "curated" sources (one per content type) so admin-created
--    items flow through the existing source-join type filters unchanged.
-- 4. Reclassify Huberman Lab from 'video' to 'podcast'.
-- 5. Ensure the Nature Aging research source exists with the correct type.

-- 1. Allow podcast + research content types
ALTER TABLE public.rss_sources
  DROP CONSTRAINT IF EXISTS rss_sources_content_type_check;
ALTER TABLE public.rss_sources
  ADD CONSTRAINT rss_sources_content_type_check
  CHECK (content_type IN ('article', 'video', 'podcast', 'topic', 'research'));

-- 2. source_type: where an item came from.
--    'feed'    = ingested automatically from an RSS/YouTube feed (default,
--                backfills all existing rows)
--    'curated' = added manually by an admin via the Create Item tool
ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'feed'
    CHECK (source_type IN ('curated', 'feed'));

-- Topical label for items (e.g. "Sleep", "Supplements")
ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS tag VARCHAR(100);

CREATE INDEX IF NOT EXISTS rss_items_source_type_idx ON public.rss_items(source_type);

-- 3. Internal curated sources. Admin-created items attach to one of these so
--    every existing type-filtered query (which joins through
--    rss_sources.content_type) picks them up without changes.
--    feed_url uses an internal:// marker; the ingestion service skips these.
INSERT INTO public.rss_sources (name, slug, feed_url, content_type, is_active, is_featured)
VALUES
  ('Curated Articles', 'curated-articles', 'internal://curated/article',  'article',  true, false),
  ('Curated Videos',   'curated-videos',   'internal://curated/video',    'video',    true, false),
  ('Curated Podcasts', 'curated-podcasts', 'internal://curated/podcast',  'podcast',  true, false),
  ('Curated Topics',   'curated-topics',   'internal://curated/topic',    'topic',    true, false),
  ('Curated Research', 'curated-research', 'internal://curated/research', 'research', true, false)
ON CONFLICT (feed_url) DO NOTHING;

-- 4. Fix mislabeled sources.
--    Huberman Lab is a podcast distributed via YouTube; it was typed 'video',
--    which made podcast episodes show up in video sections and left the
--    "Top Podcasts" rail with no real data. Items inherit their type through
--    the source join, so this single update reclassifies all its items.
UPDATE public.rss_sources
SET content_type = 'podcast', updated_at = NOW()
WHERE feed_url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC2D2CMWXMOVWx7giW1n3LIg'
  AND content_type <> 'podcast';

-- 5. Nature Aging research source (previously rejected by the CHECK constraint).
--    If it was ever inserted under a wrong type, correct it.
INSERT INTO public.rss_sources (name, slug, feed_url, image_url, content_type, is_active)
VALUES (
  'Nature Aging',
  'nature-aging',
  'http://feeds.nature.com/nataging/rss/current',
  'https://www.nature.com/static/images/favicons/nature/apple-touch-icon.png',
  'research',
  true
)
ON CONFLICT (feed_url) DO UPDATE
  SET content_type = 'research', updated_at = NOW();

-- Note on write access: inserts into rss_items remain governed by the
-- permissive "Service can insert RSS items" policy from 008 because feed
-- ingestion runs with the anon-key server client (cron secret auth, no user
-- session). Admin-created items are gated server-side by a role check in
-- POST /api/admin/items.

COMMENT ON COLUMN public.rss_items.source_type IS 'feed = auto-ingested from RSS; curated = manually added by an admin';
COMMENT ON COLUMN public.rss_items.tag IS 'Topical label shown on cards (e.g. Sleep, Supplements)';
