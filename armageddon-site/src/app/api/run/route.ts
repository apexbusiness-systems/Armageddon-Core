/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — API ROUTE
 * POST /api/run — Start a certification run
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client, Connection } from '@temporalio/client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RunRequest {
    organizationId: string;
    level?: number;
    iterations?: number;
}

interface RunResponse {
    success: boolean;
    runId?: string;
    workflowId?: string;
    error?: string;
    upsellMessage?: string;
    upgradeUrl?: string;
}

type OrganizationTier = 'free_dry' | 'verified' | 'certified';

// ═══════════════════════════════════════════════════════════════════════════
// TIER ACCESS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TIER_LEVEL_ACCESS: Record<OrganizationTier, number[]> = {
    free_dry: [1, 2, 3],
    verified: [1, 2, 3, 4, 5, 6],
    certified: [1, 2, 3, 4, 5, 6, 7],
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase credentials');
    }

    return createClient(url, key, {
        auth: { persistSession: false },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL CLIENT
// ═══════════════════════════════════════════════════════════════════════════

async function getTemporalClient(): Promise<Client> {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

    const connection = await Connection.connect({ address });

    return new Client({
        connection,
        namespace,
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════

async function checkRunEligibility(
    orgId: string,
    requestedLevel: number
): Promise<{ eligible: boolean; tier: OrganizationTier; error?: string; upsellMessage?: string }> {
    const supabase = getSupabase();

    // Fetch organization
    const { data: org, error } = await supabase
        .from('organizations')
        .select('id, current_tier')
        .eq('id', orgId)
        .single();

    if (error || !org) {
        return {
            eligible: false,
            tier: 'free_dry',
            error: 'Organization not found',
        };
    }

    const tier = org.current_tier as OrganizationTier;
    const allowedLevels = TIER_LEVEL_ACCESS[tier];

    if (allowedLevels.includes(requestedLevel)) {
        return { eligible: true, tier };
    }

    // Level 7 requires certified
    if (requestedLevel === 7) {
        return {
            eligible: false,
            tier,
            error: 'ACCESS_DENIED',
            upsellMessage: '🔒 Level 7 God Mode requires CERTIFIED tier. ' +
                'Upgrade to unlock 10,000+ iteration adversarial testing with ' +
                'Batteries 10-13 (Goal Hijack, Tool Misuse, Memory Poison, Supply Chain).',
        };
    }

    return {
        eligible: false,
        tier,
        error: 'ACCESS_DENIED',
        upsellMessage: `Level ${requestedLevel} requires a higher tier.`,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<RunResponse>> {
    try {
        // Parse request body
        const body: RunRequest = await request.json();
        const { organizationId, level = 7, iterations = 2500 } = body;

        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: 'organizationId is required' },
                { status: 400 }
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Check eligibility
        // ═══════════════════════════════════════════════════════════════════

        const eligibility = await checkRunEligibility(organizationId, level);

        if (!eligibility.eligible) {
            return NextResponse.json(
                {
                    success: false,
                    error: eligibility.error,
                    upsellMessage: eligibility.upsellMessage,
                    upgradeUrl: '/pricing?upgrade=certified',
                },
                { status: 403 }
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Create run record
        // ═══════════════════════════════════════════════════════════════════

        const supabase = getSupabase();
        const runId = uuidv4();
        const workflowId = `armageddon-${runId}`;

        const { error: insertError } = await supabase
            .from('armageddon_runs')
            .insert({
                id: runId,
                organization_id: organizationId,
                level,
                sim_mode: true,
                sandbox_tenant: process.env.SANDBOX_TENANT || 'armageddon-test',
                workflow_id: workflowId,
                status: 'pending',
            });

        if (insertError) {
            console.error('Failed to create run record:', insertError);
            return NextResponse.json(
                { success: false, error: 'Failed to create run record' },
                { status: 500 }
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Start Temporal workflow
        // ═══════════════════════════════════════════════════════════════════

        const client = await getTemporalClient();

        const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            workflowId,
            taskQueue: 'armageddon-level7',
            args: [{
                runId,
                organizationId,
                iterations,
            }],
        });

        // Update run with workflow_run_id
        await supabase
            .from('armageddon_runs')
            .update({
                workflow_run_id: handle.firstExecutionRunId,
                status: 'running',
                started_at: new Date().toISOString(),
            })
            .eq('id', runId);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Return success
        // ═══════════════════════════════════════════════════════════════════

        return NextResponse.json({
            success: true,
            runId,
            workflowId,
        });

    } catch (error) {
        console.error('Run API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET HANDLER (Status check)
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
        return NextResponse.json(
            { success: false, error: 'runId is required' },
            { status: 400 }
        );
    }

    const supabase = getSupabase();

    const { data: run, error } = await supabase
        .from('armageddon_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (error || !run) {
        return NextResponse.json(
            { success: false, error: 'Run not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({
        success: true,
        run,
    });
}
