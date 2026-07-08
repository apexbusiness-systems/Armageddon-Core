-- increment_rate_limit is SECURITY DEFINER and is called server-side only
-- (edge worker / api-server, both authenticated via the service-role key).
-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- the original migration (20260224_add_rate_limits.sql) never revoked --
-- letting unauthenticated (anon) and authenticated end users call the
-- exposed /rest/v1/rpc/increment_rate_limit endpoint directly and
-- manipulate rate-limit bucket state. Lock it to service_role only,
-- matching actual (and intended) callers.
--
-- Applied directly to production via the Supabase MCP connector on
-- 2026-07-08 (migration version 20260708000000 in Supabase's tracked
-- history). Verified: anon calls now return 42501 "permission denied for
-- function increment_rate_limit"; the anon/authenticated SECURITY DEFINER
-- advisor findings for this function no longer appear.
REVOKE EXECUTE ON FUNCTION increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) TO service_role;
