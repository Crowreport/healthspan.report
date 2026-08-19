-- Week 3: harden the audience dimension + add general health sources.
--
-- Builds on the nullable `audience` columns introduced alongside the men's/
-- women's sections (rss_sources.audience and rss_items.audience). Those were
-- deliberately nullable for backwards compatibility, which left "unclassified"
-- and "general" as two different states that every reader has to collapse
-- itself. This migration finishes the job:
--
--   1. Backfill every NULL audience to 'general', then make the columns
--      NOT NULL DEFAULT 'general' so there is exactly one representation of
--      "applies to everyone".
--   2. Register the new general health/longevity outlets (WebMD, Healthline,
--      Harvard Health, Everyday Health, Men's Health, Women's Health).
--   3. Realign existing items with their source's audience.
--
-- Idempotent throughout: ADD COLUMN IF NOT EXISTS, constraints dropped before
-- being recreated, and sources upserted ON CONFLICT (feed_url).

-- ---------------------------------------------------------------------------
-- 1. Audience columns: NULL -> 'general', then NOT NULL
-- ---------------------------------------------------------------------------

-- Create the columns if this runs against a database that never received the
-- earlier audience migration, so 017 alone is sufficient to reach the target
-- schema.
ALTER TABLE public.rss_sources
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20);
ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20);

-- Backfill before adding NOT NULL — SET NOT NULL fails if any NULL remains.
-- Existing rows are all general-audience content: the audience-specific
-- outlets are introduced by this same migration below.
UPDATE public.rss_sources SET audience = 'general' WHERE audience IS NULL;
UPDATE public.rss_items   SET audience = 'general' WHERE audience IS NULL;

ALTER TABLE public.rss_sources
  ALTER COLUMN audience SET DEFAULT 'general';
ALTER TABLE public.rss_sources
  ALTER COLUMN audience SET NOT NULL;

ALTER TABLE public.rss_items
  ALTER COLUMN audience SET DEFAULT 'general';
ALTER TABLE public.rss_items
  ALTER COLUMN audience SET NOT NULL;

-- Recreate the CHECK constraints by a known name. The earlier migration created
-- them inline (auto-named), so drop both the inline name and ours before
-- adding, keeping this safe to re-run.
ALTER TABLE public.rss_sources
  DROP CONSTRAINT IF EXISTS rss_sources_audience_check;
ALTER TABLE public.rss_sources
  ADD CONSTRAINT rss_sources_audience_check
  CHECK (audience IN ('general', 'women', 'men'));

ALTER TABLE public.rss_items
  DROP CONSTRAINT IF EXISTS rss_items_audience_check;
ALTER TABLE public.rss_items
  ADD CONSTRAINT rss_items_audience_check
  CHECK (audience IN ('general', 'women', 'men'));

COMMENT ON COLUMN public.rss_sources.audience IS
  'Audience stamped onto items ingested from this source: general (default), women, or men.';
COMMENT ON COLUMN public.rss_items.audience IS
  'Who the item is aimed at: general (default), women, or men. Inherited from rss_sources.audience at ingestion time; an admin may override a single item without affecting the rest of the feed.';

-- Audience is always queried alongside recency ("latest women's health"), so
-- index the pair. The single-column rss_items_audience_idx from the earlier
-- migration stays — it still serves count-by-audience queries.
CREATE INDEX IF NOT EXISTS rss_items_audience_published_idx
  ON public.rss_items (audience, published_at DESC);

-- ---------------------------------------------------------------------------
-- 2. General health / longevity sources
-- ---------------------------------------------------------------------------

-- These outlets broaden coverage beyond the existing longevity-specialist
-- feeds (Lifespan.io, Fight Aging!, Peter Attia, …) into mainstream health,
-- and supply the men's/women's sections with real audience-specific content.
-- All are standard RSS, so the existing regular-feed ingestion path handles
-- them with no new code.
--
-- Every URL below was fetched and parsed before being added. WebMD
-- (rssfeeds.webmd.com), Harvard Health (/blog/feed) and Everyday Health
-- (/rss/all.xml) were all evaluated and rejected — they now return connection
-- failures or 404s — so ScienceDaily and NIA stand in as the general-health
-- and aging-research sources.
--
-- ON CONFLICT (feed_url) DO UPDATE keeps name/image/type/audience in sync on
-- re-run without resetting fetch counters or is_active.
INSERT INTO public.rss_sources
  (name, slug, feed_url, website_url, image_url, content_type, audience, is_active, is_featured)
VALUES
  (
    'Healthline',
    'healthline',
    'https://www.healthline.com/rss/health-news',
    'https://www.healthline.com',
    'https://www.healthline.com/favicon.ico',
    'article',
    'general',
    true,
    false
  ),
  (
    'ScienceDaily Health',
    'sciencedaily-health',
    'https://www.sciencedaily.com/rss/health_medicine.xml',
    'https://www.sciencedaily.com',
    'https://www.sciencedaily.com/favicon.ico',
    'article',
    'general',
    true,
    false
  ),
  (
    'National Institute on Aging',
    'nia-nih',
    'https://www.nia.nih.gov/news/rss.xml',
    'https://www.nia.nih.gov',
    'https://www.nia.nih.gov/favicon.ico',
    'research',
    'general',
    true,
    false
  ),
  (
    'Prevention',
    'prevention',
    'https://www.prevention.com/rss/all.xml/',
    'https://www.prevention.com',
    'https://www.prevention.com/favicon.ico',
    'article',
    'general',
    true,
    false
  ),
  (
    'Men''s Health',
    'mens-health',
    'https://www.menshealth.com/rss/all.xml/',
    'https://www.menshealth.com',
    'https://www.menshealth.com/favicon.ico',
    'article',
    'men',
    true,
    false
  ),
  (
    'Women''s Health',
    'womens-health',
    'https://www.womenshealthmag.com/rss/all.xml/',
    'https://www.womenshealthmag.com',
    'https://www.womenshealthmag.com/favicon.ico',
    'article',
    'women',
    true,
    false
  )
ON CONFLICT (feed_url) DO UPDATE
  SET name         = EXCLUDED.name,
      website_url  = EXCLUDED.website_url,
      image_url    = EXCLUDED.image_url,
      content_type = EXCLUDED.content_type,
      audience     = EXCLUDED.audience,
      updated_at   = NOW();

-- ---------------------------------------------------------------------------
-- 3. Realign existing items with their source
-- ---------------------------------------------------------------------------

-- Items ingested before the audience column existed were just defaulted to
-- 'general' in step 1. For audience-specific outlets that is wrong, so pull the
-- item's audience from its source. Only touches rows still sitting at the
-- default, so an admin's per-item override is preserved.
UPDATE public.rss_items i
SET audience = s.audience,
    updated_at = NOW()
FROM public.rss_sources s
WHERE i.source_id = s.id
  AND s.audience <> 'general'
  AND i.audience = 'general';
