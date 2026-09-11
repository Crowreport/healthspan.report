-- Week 6: sponsored homepage placements.
--
-- One table, public.sponsors — a paid placement card shown on the homepage
-- (style guide 3.4: white card, #E0D6C4 border, red CTA, yellow "Sponsored"
-- label). No relationship to rss_items/rss_sources; sponsors are a distinct
-- kind of content, authored directly rather than ingested.
--
-- display_order is nullable and sorts NULLS LAST, mirroring the
-- featured_priority pattern from migration 016: omit it and a sponsor still
-- shows, just at the end: an admin never has to backfill a number to publish.
--
-- Idempotent throughout, matching migrations 016-020.

CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  cta_label TEXT NOT NULL DEFAULT 'Learn more',
  cta_url TEXT NOT NULL,
  -- Shown under the card per ad-disclosure convention (style guide doesn't
  -- specify copy, but an affiliate/paid placement needs one to be honest
  -- about what it is).
  disclosure TEXT NOT NULL DEFAULT 'Sponsored placement.',
  display_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sponsors IS
  'Sponsored homepage placements. Authored directly (dashboard/admin tool), not ingested. is_active gates display; display_order (NULL = last) controls ordering among active rows.';

ALTER TABLE public.sponsors
  DROP CONSTRAINT IF EXISTS sponsors_name_not_blank;
ALTER TABLE public.sponsors
  ADD CONSTRAINT sponsors_name_not_blank
  CHECK (length(btrim(name)) > 0);

ALTER TABLE public.sponsors
  DROP CONSTRAINT IF EXISTS sponsors_headline_not_blank;
ALTER TABLE public.sponsors
  ADD CONSTRAINT sponsors_headline_not_blank
  CHECK (length(btrim(headline)) > 0);

CREATE INDEX IF NOT EXISTS sponsors_active_order_idx
  ON public.sponsors (display_order ASC NULLS LAST, created_at DESC)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS sponsors_set_updated_at ON public.sponsors;
CREATE TRIGGER sponsors_set_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

-- A sponsored card is public by definition — it's an ad. Anyone (including
-- anonymous visitors) can read active sponsors; inactive ones are excluded at
-- the API layer's query, not by RLS, so a preview/admin tool with elevated
-- access can still see paused placements.
DROP POLICY IF EXISTS "Sponsors are viewable by everyone" ON public.sponsors;
CREATE POLICY "Sponsors are viewable by everyone"
  ON public.sponsors
  FOR SELECT
  USING (true);

-- Authoring is admin-only, same as community_questions: no member-facing
-- write policy. Sponsors are created/edited through the Supabase dashboard or
-- a service-role admin tool, both of which bypass RLS.
