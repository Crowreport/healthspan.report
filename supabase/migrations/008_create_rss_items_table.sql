-- Create RSS items table for storing ingested content
-- This table stores normalized content from all RSS feeds with deduplication

CREATE TABLE IF NOT EXISTS public.rss_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.rss_sources(id) ON DELETE CASCADE,
  
  -- Unique identifier for deduplication (usually the item link/URL)
  guid VARCHAR(500) NOT NULL,
  
  -- Normalized content fields
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content TEXT,
  external_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  
  -- Metadata
  author VARCHAR(255),
  published_at TIMESTAMPTZ NOT NULL,
  duration VARCHAR(50), -- For videos: "12:34" format
  
  -- YouTube-specific normalized fields
  youtube_video_id VARCHAR(20),
  youtube_channel_name VARCHAR(255),
  view_count VARCHAR(50),
  
  -- Internal tracking
  is_featured BOOLEAN NOT NULL DEFAULT false,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure uniqueness per source (same item can't be ingested twice)
  UNIQUE(source_id, guid)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS rss_items_source_id_idx ON public.rss_items(source_id);
CREATE INDEX IF NOT EXISTS rss_items_guid_idx ON public.rss_items(guid);
CREATE INDEX IF NOT EXISTS rss_items_slug_idx ON public.rss_items(slug);
CREATE INDEX IF NOT EXISTS rss_items_published_at_idx ON public.rss_items(published_at DESC);
CREATE INDEX IF NOT EXISTS rss_items_youtube_video_id_idx ON public.rss_items(youtube_video_id);
CREATE INDEX IF NOT EXISTS rss_items_ingested_at_idx ON public.rss_items(ingested_at DESC);
CREATE INDEX IF NOT EXISTS rss_items_is_featured_idx ON public.rss_items(is_featured);

-- Composite index for type + published_at queries (via source join)
CREATE INDEX IF NOT EXISTS rss_items_source_published_idx ON public.rss_items(source_id, published_at DESC);

-- Enable Row Level Security
ALTER TABLE public.rss_items ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read items from active sources
CREATE POLICY "RSS items from active sources are viewable by everyone"
  ON public.rss_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rss_sources
      WHERE id = rss_items.source_id AND is_active = true
    )
  );

-- Policy: Admins can view all items
CREATE POLICY "Admins can view all RSS items"
  ON public.rss_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: System/service role can insert items (for ingestion)
-- Note: In production, use service role key for ingestion
CREATE POLICY "Service can insert RSS items"
  ON public.rss_items
  FOR INSERT
  WITH CHECK (true); -- Ingestion happens server-side with service role

-- Policy: Service can update items
CREATE POLICY "Service can update RSS items"
  ON public.rss_items
  FOR UPDATE
  USING (true);

-- Policy: Only admins can delete items
CREATE POLICY "Admins can delete RSS items"
  ON public.rss_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_rss_items_updated_at ON public.rss_items;
CREATE TRIGGER update_rss_items_updated_at
  BEFORE UPDATE ON public.rss_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up old items (keep last 100 per source)
CREATE OR REPLACE FUNCTION public.cleanup_old_rss_items()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rss_items
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY published_at DESC) as rn
      FROM public.rss_items
    ) ranked
    WHERE rn > 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
