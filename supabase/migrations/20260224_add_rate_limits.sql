-- Rate Limiting Migration for Armageddon Level 7

CREATE TABLE IF NOT EXISTS global_rate_limits (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    limit_count INTEGER NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, key, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_global_rate_limits_expires_at ON global_rate_limits(expires_at);

ALTER TABLE global_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits directly
CREATE POLICY "service_role_full_access_rate_limits"
    ON global_rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Race-safe increment function
CREATE OR REPLACE FUNCTION increment_rate_limit(
    p_scope TEXT,
    p_key TEXT,
    p_bucket_start TIMESTAMPTZ,
    p_limit_count INTEGER,
    p_expires_at TIMESTAMPTZ
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMPTZ
) AS $$
DECLARE
    v_used_count INTEGER;
BEGIN
    INSERT INTO global_rate_limits (scope, key, bucket_start, limit_count, used_count, expires_at)
    VALUES (p_scope, p_key, p_bucket_start, p_limit_count, 1, p_expires_at)
    ON CONFLICT (scope, key, bucket_start) DO UPDATE
    SET used_count = CASE 
        WHEN global_rate_limits.used_count < global_rate_limits.limit_count THEN global_rate_limits.used_count + 1
        ELSE global_rate_limits.used_count
    END
    RETURNING used_count INTO v_used_count;

    RETURN QUERY SELECT 
        (v_used_count <= p_limit_count) AS allowed,
        GREATEST(0, p_limit_count - v_used_count) AS remaining,
        p_expires_at AS reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rollback section
-- DROP FUNCTION IF EXISTS increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ);
-- DROP TABLE IF EXISTS global_rate_limits;
