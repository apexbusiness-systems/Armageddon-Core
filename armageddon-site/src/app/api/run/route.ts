/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — API ROUTE
 * POST /api/run — Start a certification run
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { checkRunEligibility } from '@armageddon/shared';
import { RateLimiter } from '@/lib/rate-limit';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { getTemporalClient } from '@/lib/temporal';

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
// RATE LIMITERS (MODULE-LEVEL SINGLETONS)
// ═══════════════════════════════════════════════════════════════════════════

const ipLimiter = new RateLimiter({
    intervalMs: 60 * 1000, // 1 minute
    limit: 10,             // 10 requests per minute per IP
});

const orgLimiter = new RateLimiter({
    intervalMs: 60 * 1000, // 1 minute
    limit: 5,              // 5 runs per minute per organization
});

// ELIGIBILITY CHECK
// Using centralized checkRunEligibility from armageddon-core/src/core/monetization/gate.ts

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<RunResponse>> {
    try {
        // 1. IP-based Rate Limiting (Pre-parsing)
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!ipLimiter.check(ip)) {
            console.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again in a minute.' },
                { status: 429 }
            );
        }

        // Parse request body
        const body: RunRequest = await request.json();
        const { organizationId, level = 7, iterations = 2500, batteries } = body;

        // 2. Authentication & Authorization
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token format' }, { status: 401 });
        }

        // Get singleton Supabase client
        const supabase = getSupabaseServiceRole();

        // Validate token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.warn(`[Security] Invalid token: ${authError?.message}`);
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // Verify organization membership
        if (organizationId) {
            const { data: membership, error: membershipError } = await supabase
                .from('organization_members')
                .select('role')
                .eq('organization_id', organizationId)
                .eq('user_id', user.id)
                .single();

            if (membershipError || !membership) {
                console.warn(`[Security] User ${user.id} attempted to access organization ${organizationId} without membership`);
                return NextResponse.json({ success: false, error: 'Forbidden: You are not a member of this organization' }, { status: 403 });
            }
        } else {
            return NextResponse.json(
                { success: false, error: 'organizationId is required' },
                { status: 400 }
            );
        }

        // 3. Organization-based Rate Limiting
        if (organizationId && !orgLimiter.check(organizationId)) {
            console.warn(`[Security] Rate limit exceeded for Organization: ${organizationId}`);
            return NextResponse.json(
                { success: false, error: 'Organization rate limit exceeded. Please try again in a minute.' },
                { status: 429 }
            );
        }

        // Validate token
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
             return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        // Get singleton Supabase client
        const supabase = getSupabaseServiceRole();

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.warn(`[Security] Invalid token: ${authError?.message}`);
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // Verify organization membership
        if (organizationId) {
            const { data: membership, error: membershipError } = await supabase
                .from('organization_members')
                .select('role')
                .eq('organization_id', organizationId)
                .eq('user_id', user.id)
                .single();

            if (membershipError || !membership) {
                console.warn(`[Security] User ${user.id} attempted to access organization ${organizationId} without membership`);
                return NextResponse.json({ success: false, error: 'Forbidden: You are not a member of this organization' }, { status: 403 });
            }
        } else {
             return NextResponse.json(
                { success: false, error: 'organizationId is required' },
                { status: 400 }
            );
        }

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

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Check eligibility (including battery customization)
        // ═══════════════════════════════════════════════════════════════════

        // Pass injected client for performance
        const eligibility = await checkRunEligibility(
            organizationId,
            level,
            validatedBatteries,
            supabase
        );

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

        // Reuse the same supabase instance
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

    const supabase = getSupabaseServiceRole();

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
