-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON LEVEL 7 — Migration Runner (Production-safe)
-- Wraps all DDL in a transaction with pre-flight checks.
-- Usage: psql -h <host> -U temporal -d temporal -f apply_migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ─── PRE-FLIGHT: verify target table exists ─────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'armageddon_runs'
    ) THEN
        RAISE EXCEPTION 'PRE-FLIGHT FAILED: table "armageddon_runs" does not exist. Aborting migration.';
    END IF;
END
$$;

-- ─── BEGIN TRANSACTIONAL MIGRATION ──────────────────────────────────────
BEGIN;

-- Add config column to armageddon_runs
ALTER TABLE armageddon_runs
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Add index for efficient config queries
CREATE INDEX IF NOT EXISTS idx_runs_config ON armageddon_runs USING gin(config);

-- Add documentation comment
COMMENT ON COLUMN armageddon_runs.config IS 'Run configuration including battery selection, e.g., {"batteries": ["B10", "B12"]}';

-- ─── POST-MIGRATION VERIFICATION ──────────────────────────────────────
DO $$
DECLARE
    col_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'armageddon_runs' AND column_name = 'config'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'POST-MIGRATION FAILED: column "config" was not created. Rolling back.';
    END IF;
END
$$;

COMMIT;
-- On any error above, \set ON_ERROR_STOP causes psql to abort.
-- If running programmatically, catch the error and issue ROLLBACK explicitly.

-- ─── VERIFICATION OUTPUT ────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'armageddon_runs' AND column_name = 'config';
