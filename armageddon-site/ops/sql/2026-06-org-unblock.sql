-- ============================================================================
-- ORG-UNBLOCK — OPERATOR-RUN SQL (PRODUCTION DATA MUTATION)
-- ============================================================================
-- Purpose : Give one account an organization + a membership row so that
--           resolveActiveOrg() -> /api/run stops returning
--           "No organization membership". This is the single data/provisioning
--           gap blocking runs for an account that has no organization_members row.
--
-- ⚠  DO NOT RUN UNREVIEWED. This file mutates PRODUCTION data.
-- ⚠  It is NOT wired into any migration runner, CI step, or deploy script,
--    and must never be. Review every line, fill the placeholders, then run it
--    yourself against the intended database.
--
-- Schema source : verified against the canonical committed DDL in
--                 supabase/migrations/20260125_armageddon_init.sql
--                 (single source of truth; no later migration ALTERs these
--                 tables). NOTE: live-connection introspection was NOT
--                 available in the authoring environment (no DATABASE_URL,
--                 no psql). BEFORE RUNNING, confirm the live schema still
--                 matches by running the PRE-RUN CHECK block below.
--
-- Idempotent : safe to run more than once. The org is created only if its
--              slug does not already exist; the membership uses
--              ON CONFLICT (organization_id, user_id) DO NOTHING.
--
-- Role : 'member' — the LOWEST privilege that satisfies the run gate.
--        /api/me/organizations only requires >= 1 membership row (any role),
--        and the account's tier gating is handled separately (ADMIN_EMAIL
--        override -> 'verified'). Do NOT grant 'owner'/'admin' here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 0 — SET THESE PLACEHOLDERS (psql \set). For the Supabase SQL editor,
-- replace each :'name' below with a quoted literal instead.
-- ----------------------------------------------------------------------------
-- SET :target_user_id  -- auth.users.id (UUID) of the account to unblock
-- SET :org_name        -- human-readable organization name
-- SET :org_slug        -- stable unique slug (lowercase, hyphenated)
\set target_user_id 'REPLACE_WITH_AUTH_USERS_UUID'
\set org_name       'Armageddon Test Org'
\set org_slug       'armageddon-test-org'

-- Helper (run separately if you only have the email):
--   select id from auth.users where email = 'armageddon.test.suite.cert@gmail.com';
-- Paste the returned UUID into :target_user_id above.

-- ----------------------------------------------------------------------------
-- PRE-RUN CHECK (read-only) — confirm live schema matches before mutating.
-- Expect: organizations(slug unique), organization_members(role check
--         {owner,admin,member}, unique(organization_id,user_id)).
-- ----------------------------------------------------------------------------
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_name in ('organizations','organization_members')
--  order by table_name, ordinal_position;
-- select conname, contype from pg_constraint
--  where conrelid = 'organization_members'::regclass;

-- ----------------------------------------------------------------------------
-- MUTATION — single transaction, idempotent.
-- ----------------------------------------------------------------------------
begin;

with existing_org as (
    select id from organizations where slug = :'org_slug'
),
inserted_org as (
    insert into organizations (name, slug)
    select :'org_name', :'org_slug'
    where not exists (select 1 from existing_org)
    returning id
),
org as (
    select id from inserted_org
    union all
    select id from existing_org
)
insert into organization_members (organization_id, user_id, role)
select org.id, :'target_user_id'::uuid, 'member'
from org
on conflict (organization_id, user_id) do nothing;

commit;

-- ----------------------------------------------------------------------------
-- POST-RUN VERIFICATION (read-only) — expect exactly one row, role='member'.
-- ----------------------------------------------------------------------------
-- select om.organization_id, om.user_id, om.role, o.slug, o.name
--   from organization_members om
--   join organizations o on o.id = om.organization_id
--  where om.user_id = :'target_user_id'::uuid
--    and o.slug = :'org_slug';
