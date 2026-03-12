# Migration Script Verification — Launch Checklist

> **CLASSIFICATION**: INTERNAL | **Last Updated**: 2026-02-25

---

## Pre-Migration Checklist

- [ ] **Backup**: Snapshot the target database (`pg_dump -Fc armageddon > backup_$(date +%Y%m%d).dump`)
- [ ] **Read the SQL**: Review `apply_migration.sql` for correctness. Verify `IF NOT EXISTS` guards.
- [ ] **Dry Run**: Execute against a staging/local database first:
  ```bash
  psql -h localhost -U temporal -d temporal -f apply_migration.sql
  ```
- [ ] **Verify Transaction Safety**: Confirm `BEGIN`/`COMMIT` wrapping in the SQL file.
- [ ] **Check Pre-flight**: The script will abort if `armageddon_runs` table does not exist.

## Execution

```bash
# Production (use .env.moat credentials)
source .env.moat
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d temporal -f apply_migration.sql
```

## Post-Migration Verification

- [ ] `config` column exists: `SELECT column_name FROM information_schema.columns WHERE table_name='armageddon_runs' AND column_name='config';`
- [ ] GIN index exists: `SELECT indexname FROM pg_indexes WHERE tablename='armageddon_runs' AND indexname='idx_runs_config';`
- [ ] Application health: Verify worker can write `config` JSONB via the Armageddon suite.

## Rollback Plan

If migration fails mid-transaction, PostgreSQL auto-rolls back (no partial state).
For manual rollback after successful apply:

```sql
BEGIN;
DROP INDEX IF EXISTS idx_runs_config;
ALTER TABLE armageddon_runs DROP COLUMN IF EXISTS config;
COMMIT;
```

## apply_migration.mjs Status

✅ Production-ready (reviewed 2026-02-21). Robust error handling with RPC fallback guidance.
