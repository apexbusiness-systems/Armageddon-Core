-- Connect and run migration
\set ON_ERROR_STOP on

-- Add config column to armageddon_runs
ALTER TABLE armageddon_runs 
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Add index for efficient config queries
CREATE INDEX IF NOT EXISTS idx_runs_config ON armageddon_runs USING gin(config);

-- Add comment
COMMENT ON COLUMN armageddon_runs.config IS 'Run configuration including battery selection, e.g., {"batteries": ["B10", "B12"]}';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'armageddon_runs' AND column_name = 'config';
