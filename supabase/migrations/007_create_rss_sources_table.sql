-- Create RSS sources table for tracking configured feed sources
-- This stores the feed configurations for periodic polling

CREATE TABLE IF NOT EXISTS public.rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  feed_url VARCHAR(500) UNIQUE NOT NULL,
  website_url VARCHAR(500),
  image_url VARCHAR(500),
  description TEXT,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('article', 'video', 'topic')),
  -- YouTube-specific fields
  youtube_channel_id VARCHAR(50),
  is_youtube_feed BOOLEAN NOT NULL DEFAULT false,
  -- Status and metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  last_fetched_at TIMESTAMPTZ,
  last_fetch_error TEXT,
  fetch_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS rss_sources_slug_idx ON public.rss_sources(slug);
CREATE INDEX IF NOT EXISTS rss_sources_content_type_idx ON public.rss_sources(content_type);
CREATE INDEX IF NOT EXISTS rss_sources_is_active_idx ON public.rss_sources(is_active);
CREATE INDEX IF NOT EXISTS rss_sources_is_youtube_feed_idx ON public.rss_sources(is_youtube_feed);
CREATE INDEX IF NOT EXISTS rss_sources_youtube_channel_id_idx ON public.rss_sources(youtube_channel_id);

-- Enable Row Level Security
ALTER TABLE public.rss_sources ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active sources
CREATE POLICY "Active RSS sources are viewable by everyone"
  ON public.rss_sources
  FOR SELECT
  USING (is_active = true);

-- Policy: Admins can view all sources
CREATE POLICY "Admins can view all RSS sources"
  ON public.rss_sources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can insert sources
CREATE POLICY "Admins can insert RSS sources"
  ON public.rss_sources
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can update sources
CREATE POLICY "Admins can update RSS sources"
  ON public.rss_sources
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can delete sources
CREATE POLICY "Admins can delete RSS sources"
  ON public.rss_sources
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_rss_sources_updated_at ON public.rss_sources;
CREATE TRIGGER update_rss_sources_updated_at
  BEFORE UPDATE ON public.rss_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
