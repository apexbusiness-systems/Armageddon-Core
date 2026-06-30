-- REVIEW BEFORE RUNNING: organization membership unblock draft
-- Last reviewed: 2026-06-27
-- Purpose: create a workspace organization and owner/admin membership for a
-- known Supabase auth user when /api/me/organizations blocks runs because the
-- user has no organization_members row.
--
-- DO NOT RUN AS-IS. Replace the placeholder values in the params CTE after
-- operator review. This file intentionally contains no secrets.
--
-- Expected tables are defined in supabase/migrations/20260125_armageddon_init.sql.
-- This draft is idempotent: repeated execution with the same params should not
-- duplicate organization or membership rows.

BEGIN;

WITH params AS (
    SELECT
        'REPLACE_WITH_ORG_SLUG'::text AS org_slug,
        'REPLACE_WITH_ORG_NAME'::text AS org_name,
        'REPLACE_WITH_USER_EMAIL'::text AS user_email,
        'owner'::text AS member_role
), resolved_user AS (
    SELECT u.id AS user_id, p.org_slug, p.org_name, p.member_role
    FROM params p
    JOIN auth.users u ON lower(u.email) = lower(p.user_email)
), upsert_org AS (
    INSERT INTO public.organizations (name, slug)
    SELECT ru.org_name, ru.org_slug
    FROM resolved_user ru
    ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name
    RETURNING id, slug
)
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT o.id, ru.user_id, ru.member_role
FROM upsert_org o
JOIN resolved_user ru ON ru.org_slug = o.slug
ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

COMMIT;
