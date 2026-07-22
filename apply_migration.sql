-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON LEVEL 7 — Migration Runner (Production-safe)
-- Wraps all DDL in a transaction with pre-flight checks.
-- Usage: psql -h <host> -U temporal -d temporal -f apply_migration.sql
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set TARGET_TABLE 'armageddon_runs'

-- ─── PRE-FLIGHT: verify target table exists ─────────────────────────────
-- Uses psql's own \gset/\if (not a PL/pgSQL DO block) so :'TARGET_TABLE'
-- substitution applies normally — it does not reach inside DO $$ ... $$
-- bodies, which are opaque dollar-quoted strings to psql's lexer. The actual
-- abort is a hardcoded, literal-free DO block: ON_ERROR_STOP turns its
-- RAISE EXCEPTION into a real non-zero exit, and the specific-table detail
-- was already printed by \warn above it.
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = :'TARGET_TABLE'
) AS target_table_exists \gset

\if :target_table_exists
\else
    \warn 'PRE-FLIGHT FAILED: table "' :TARGET_TABLE '" does not exist. Aborting migration.'
    DO $$ BEGIN RAISE EXCEPTION 'Aborting: pre-flight check failed (see warning above)'; END $$;
\endif

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
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = :'TARGET_TABLE' AND column_name = 'config'
) AS config_column_exists \gset

\if :config_column_exists
\else
    \warn 'POST-MIGRATION FAILED: column "config" was not created on "' :TARGET_TABLE '". Rolling back.'
    DO $$ BEGIN RAISE EXCEPTION 'Aborting: post-migration check failed (see warning above)'; END $$;
\endif

COMMIT;
-- On any error above, \set ON_ERROR_STOP causes psql to abort.
-- If running programmatically, catch the error and issue ROLLBACK explicitly.

-- ─── VERIFICATION OUTPUT ────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = :'TARGET_TABLE' AND column_name = 'config';
