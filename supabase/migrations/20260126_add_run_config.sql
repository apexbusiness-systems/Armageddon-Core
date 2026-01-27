-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON LEVEL 7 — RUN CONFIGURATION
-- Migration: Add config JSONB column to armageddon_runs
-- ═══════════════════════════════════════════════════════════════════════════

-- Add config column for storing run-specific configuration
-- This allows flexible storage of battery selection and future config options
ALTER TABLE armageddon_runs 
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Add index for efficient config queries
CREATE INDEX IF NOT EXISTS idx_runs_config ON armageddon_runs USING gin(config);

-- Comment for documentation
COMMENT ON COLUMN armageddon_runs.config IS 'Run configuration including battery selection, e.g., {"batteries": ["B10", "B12"]}';
