-- =============================================
-- Betting Chain — Supabase Setup
-- Run this in your Supabase SQL Editor (one time)
-- =============================================

-- Main runs table
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date_label TEXT NOT NULL,
  leagues TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',
  steps JSONB DEFAULT '[]',
  image_paths TEXT[] DEFAULT '{}',
  final_verdict TEXT,
  final_ticket TEXT,
  final_backup TEXT,
  final_explanation TEXT,
  recheck_required BOOLEAN,
  recommended_usage TEXT,
  result TEXT,
  profit NUMERIC
);

-- Enable Row Level Security
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (API routes use service role key)
CREATE POLICY "Service role full access" ON runs
  FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs (status);
CREATE INDEX IF NOT EXISTS idx_runs_result ON runs (result) WHERE result IS NOT NULL;


-- =============================================
-- Storage Setup
-- Do this MANUALLY in the Supabase dashboard:
-- 1. Go to Storage in the left sidebar
-- 2. Click "New bucket"
-- 3. Name: screenshots
-- 4. Toggle "Public bucket" OFF (private)
-- 5. Click "Create bucket"
-- =============================================
