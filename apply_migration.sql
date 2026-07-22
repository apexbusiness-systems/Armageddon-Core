-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON LEVEL 7 — Migration Runner (Production-safe)
-- Wraps all DDL in a transaction with pre-flight checks.
-- Usage: psql -h <host> -U temporal -d temporal -f apply_migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set TARGET_TABLE 'armageddon_runs'

-- Publish the target table name as a session-level setting so the PL/pgSQL
-- blocks below can read it via current_setting() instead of re-embedding the
-- literal — psql's :'VAR' substitution does not reach inside DO $$ ... $$
-- bodies (they're opaque dollar-quoted strings to psql's own lexer).
SELECT set_config('armageddon.target_table', :'TARGET_TABLE', false);

-- ─── PRE-FLIGHT: verify target table exists ─────────────────────────────
DO $$
DECLARE
    tbl_name CONSTANT text := current_setting('armageddon.target_table');
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = tbl_name
    ) THEN
        RAISE EXCEPTION 'PRE-FLIGHT FAILED: table "%" does not exist. Aborting migration.', tbl_name;
    END IF;
END
$$;

-- ─── BEGIN TRANSACTIONAL MIGRATION ──────────────────────────────────────
BEGIN;

-- Add config column to armageddon_runs
ALTER TABLE :"TARGET_TABLE"
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Add index for efficient config queries
CREATE INDEX IF NOT EXISTS idx_runs_config ON :"TARGET_TABLE" USING gin(config);

-- Add documentation comment
COMMENT ON COLUMN :"TARGET_TABLE".config IS 'Run configuration including battery selection, e.g., {"batteries": ["B10", "B12"]}';

-- ─── POST-MIGRATION VERIFICATION ──────────────────────────────────────
DO $$
DECLARE
    tbl_name CONSTANT text := current_setting('armageddon.target_table');
    col_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = tbl_name AND column_name = 'config'
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
WHERE table_name = :'TARGET_TABLE' AND column_name = 'config';
