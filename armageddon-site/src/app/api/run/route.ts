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
import { checkRunEligibility } from '../../../lib/gate';
import { normalizeIterations, validateBatteryIds } from '../../../lib/types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RunRequest {
    organizationId: string;
    level?: number;
    iterations?: number;
    batteries?: string[]; // Optional battery selection for Verified/Certified tiers
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

// ELIGIBILITY CHECK
// Using centralized checkRunEligibility from armageddon-core/src/core/monetization/gate.ts

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<RunResponse>> {
    try {
        // Parse request body
        const body: RunRequest = await request.json();
        const { organizationId, level = 7, iterations = 2500, batteries } = body;

        // Validate and sanitize batteries
        let validatedBatteries: string[] = ['B10', 'B11', 'B12', 'B13']; // Default: all batteries
        if (batteries && batteries.length > 0) {
            // Remove duplicates
            const uniqueBatteries = Array.from(new Set(batteries));

            // Validate battery IDs
            const validPattern = /^B1[0-3]$/;
            const invalidBatteries = uniqueBatteries.filter(b => !validPattern.test(b));

            if (invalidBatteries.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid battery IDs: ${invalidBatteries.join(', ')}. Allowed: B10, B11, B12, B13`
                    },
                    { status: 400 }
                );
            }

            validatedBatteries = uniqueBatteries;
        }

        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: 'organizationId is required' },
                { status: 400 }
            );
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Check eligibility (including battery customization)
        // ═══════════════════════════════════════════════════════════════════

        const eligibility = await checkRunEligibility(organizationId, level, validatedBatteries);

        if (!eligibility.eligible) {
            return NextResponse.json(
                {
                    success: false,
                    error: eligibility.reason || 'ACCESS_DENIED',
                    upsellMessage: eligibility.upsellMessage,
                    upgradeUrl: eligibility.upgradeUrl || '/pricing?upgrade=certified',
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
                config: { batteries: validatedBatteries },
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
                batteries: validatedBatteries,
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
