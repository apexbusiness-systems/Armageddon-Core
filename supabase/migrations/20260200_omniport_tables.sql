-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON — OMNIPORT TABLES
-- Migration: omniport_waiver_records + omniport_telemetry_events
--
-- Column shapes match the EXACT inserts/selects in the application code:
--   - armageddon-site/src/app/api/omniport/waiver/route.ts   (insert)
--   - armageddon-site/src/app/api/omniport/live-fire/route.ts (select)
--   - armageddon-site/src/lib/omniport.ts persistTelemetryEvent (insert)
-- Idempotent: every statement guarded (CREATE POLICY has no IF NOT EXISTS in
-- Postgres, so we DROP POLICY IF EXISTS first).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── omniport_waiver_records ───────────────────────────────────────────────
-- Legal proof of live-fire waiver acceptance. Returned id is the durable proof.
CREATE TABLE IF NOT EXISTS omniport_waiver_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    waiver_version    TEXT NOT NULL DEFAULT '1.0',
    waiver_token_hash TEXT NOT NULL,
    run_level         INTEGER NOT NULL CHECK (run_level >= 1 AND run_level <= 7),
    accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches the live-fire lookup: .eq(org_id).eq(run_level).gte(expires_at)
CREATE INDEX IF NOT EXISTS idx_omniport_waiver_lookup
    ON omniport_waiver_records (org_id, run_level, expires_at);

ALTER TABLE omniport_waiver_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_waiver" ON omniport_waiver_records;
CREATE POLICY "service_role_full_access_waiver"
    ON omniport_waiver_records
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ─── omniport_telemetry_events ─────────────────────────────────────────────
-- Server-to-server telemetry. `timestamp` is epoch milliseconds (Date.now()).
CREATE TABLE IF NOT EXISTS omniport_telemetry_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      TEXT NOT NULL,
    org_id      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    payload     JSONB DEFAULT '{}'::jsonb,
    "timestamp" BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omniport_telemetry_run
    ON omniport_telemetry_events (run_id);
CREATE INDEX IF NOT EXISTS idx_omniport_telemetry_org
    ON omniport_telemetry_events (org_id);

ALTER TABLE omniport_telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_telemetry" ON omniport_telemetry_events;
CREATE POLICY "service_role_full_access_telemetry"
    ON omniport_telemetry_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
