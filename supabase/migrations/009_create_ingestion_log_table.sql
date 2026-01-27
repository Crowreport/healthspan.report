-- Create ingestion log table for tracking polling runs
-- Useful for debugging and monitoring the ingestion process

CREATE TABLE IF NOT EXISTS public.rss_ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run metadata
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Results
  sources_processed INTEGER NOT NULL DEFAULT 0,
  sources_failed INTEGER NOT NULL DEFAULT 0,
  items_ingested INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0, -- Already existed (deduplication)
  items_failed INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  error_message TEXT,
  
  -- Details (JSON for flexibility)
  details JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS rss_ingestion_log_started_at_idx ON public.rss_ingestion_log(started_at DESC);
CREATE INDEX IF NOT EXISTS rss_ingestion_log_status_idx ON public.rss_ingestion_log(status);

-- Enable Row Level Security
ALTER TABLE public.rss_ingestion_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view logs
CREATE POLICY "Admins can view ingestion logs"
  ON public.rss_ingestion_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Service can insert logs
CREATE POLICY "Service can insert ingestion logs"
  ON public.rss_ingestion_log
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service can update logs
CREATE POLICY "Service can update ingestion logs"
  ON public.rss_ingestion_log
  FOR UPDATE
  USING (true);

-- Function to clean up old logs (keep last 100)
CREATE OR REPLACE FUNCTION public.cleanup_old_ingestion_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rss_ingestion_log
  WHERE id NOT IN (
    SELECT id FROM public.rss_ingestion_log
    ORDER BY started_at DESC
    LIMIT 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
