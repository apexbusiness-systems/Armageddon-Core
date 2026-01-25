-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON LEVEL 7 — DATABASE SCHEMA
-- Supabase PostgreSQL + RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE organization_tier AS ENUM ('free_dry', 'verified', 'certified');
CREATE TYPE run_status AS ENUM ('pending', 'running', 'passed', 'failed', 'cancelled');
CREATE TYPE event_severity AS ENUM ('info', 'warning', 'critical', 'blocked');

-- ═══════════════════════════════════════════════════════════════════════════
-- ORGANIZATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    current_tier organization_tier NOT NULL DEFAULT 'free_dry',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for tier lookups
CREATE INDEX idx_organizations_tier ON organizations(current_tier);
CREATE INDEX idx_organizations_stripe ON organizations(stripe_customer_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON RUNS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE armageddon_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Run configuration
    level INTEGER NOT NULL DEFAULT 7 CHECK (level >= 1 AND level <= 7),
    sim_mode BOOLEAN NOT NULL DEFAULT TRUE,
    sandbox_tenant TEXT NOT NULL,
    
    -- Temporal workflow
    workflow_id TEXT UNIQUE,
    workflow_run_id TEXT,
    
    -- Results
    status run_status NOT NULL DEFAULT 'pending',
    escape_rate DECIMAL(10, 6) DEFAULT 0,
    total_iterations INTEGER DEFAULT 0,
    breaches INTEGER DEFAULT 0,
    
    -- Batteries executed
    batteries_executed TEXT[] DEFAULT '{}',
    batteries_passed TEXT[] DEFAULT '{}',
    batteries_failed TEXT[] DEFAULT '{}',
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Duration in milliseconds
    duration_ms INTEGER
);

-- Indexes
CREATE INDEX idx_runs_org ON armageddon_runs(organization_id);
CREATE INDEX idx_runs_status ON armageddon_runs(status);
CREATE INDEX idx_runs_workflow ON armageddon_runs(workflow_id);
CREATE INDEX idx_runs_created ON armageddon_runs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON EVENTS TABLE (Granular Logs)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE armageddon_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES armageddon_runs(id) ON DELETE CASCADE,
    
    -- Event metadata
    battery_id TEXT NOT NULL, -- B10, B11, B12, B13
    iteration INTEGER NOT NULL,
    severity event_severity NOT NULL DEFAULT 'info',
    
    -- Event content
    event_type TEXT NOT NULL, -- 'attempt', 'blocked', 'breach', 'heartbeat'
    message TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for realtime queries
CREATE INDEX idx_events_run ON armageddon_events(run_id);
CREATE INDEX idx_events_battery ON armageddon_events(battery_id);
CREATE INDEX idx_events_severity ON armageddon_events(severity);
CREATE INDEX idx_events_created ON armageddon_events(created_at DESC);

-- Realtime subscription optimization
CREATE INDEX idx_events_run_created ON armageddon_events(run_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE armageddon_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE armageddon_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- ORGANIZATIONS RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Service role has full access
CREATE POLICY "service_role_full_access_organizations"
    ON organizations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read their own organization
CREATE POLICY "users_read_own_organization"
    ON organizations
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON RUNS RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Service role has full access
CREATE POLICY "service_role_full_access_runs"
    ON armageddon_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read their organization's runs
CREATE POLICY "users_read_own_runs"
    ON armageddon_runs
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- ARMAGEDDON EVENTS RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Service role has full access
CREATE POLICY "service_role_full_access_events"
    ON armageddon_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read events for their organization's runs
CREATE POLICY "users_read_own_events"
    ON armageddon_events
    FOR SELECT
    TO authenticated
    USING (
        run_id IN (
            SELECT ar.id 
            FROM armageddon_runs ar
            JOIN organization_members om ON ar.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- ORGANIZATION MEMBERS TABLE (for RLS joins)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_members"
    ON organization_members
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "users_read_own_memberships"
    ON organization_members
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable realtime for events (for live dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE armageddon_events;
ALTER PUBLICATION supabase_realtime ADD TABLE armageddon_runs;
