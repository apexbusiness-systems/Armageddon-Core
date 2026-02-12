/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — API ROUTE
 * POST /api/run — Start a certification run
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client, Connection } from '@temporalio/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { checkRunEligibility, TASK_QUEUE_LEVEL_7, WORKFLOW_LEVEL_7 } from '@armageddon/shared';
import { resolveCallerContext } from '@/lib/server/apexGate';

// ═══════════════════════════════════════════════════════════════════════════
// ENV FLAG FOR ROLLBACK
// ═══════════════════════════════════════════════════════════════════════════
const APEXGATE_DISABLED = process.env.APEXGATE_DISABLED === 'true';

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
// SUPABASE CLIENT (SINGLETON)
// ═══════════════════════════════════════════════════════════════════════════

let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabase() {
    if (cachedSupabaseClient) {
        return cachedSupabaseClient;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase credentials');
    }

    cachedSupabaseClient = createClient(url, key, {
        auth: { persistSession: false },
    });

    return cachedSupabaseClient;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL CLIENT (SINGLETON + LAZY)
// ═══════════════════════════════════════════════════════════════════════════

let cachedTemporalClient: Client | null = null;
let connectionPromise: Promise<Client> | null = null;

async function getTemporalClient(): Promise<Client> {
    // Return cached client if available
    if (cachedTemporalClient) {
        return cachedTemporalClient;
    }

    // If connection is in progress, return that promise (prevents thundering herd)
    if (connectionPromise) {
        return connectionPromise;
    }

    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const connectionOptions: any = { address };

    // Support mTLS for Temporal Cloud
    if (process.env.TEMPORAL_CERT_PATH && process.env.TEMPORAL_KEY_PATH) {
        const fs = require('node:fs'); // Dynamic require for Next.js edge compatibility if needed (though this is node runtime)
        connectionOptions.tls = {
            clientCertPair: {
                crt: fs.readFileSync(process.env.TEMPORAL_CERT_PATH),
                key: fs.readFileSync(process.env.TEMPORAL_KEY_PATH),
            },
        };
    }

    if (process.env.TEMPORAL_API_KEY) {
        connectionOptions.apiKey = process.env.TEMPORAL_API_KEY;
    }

    try {
        const connection = await Connection.connect(connectionOptions);
        const client = new Client({
            connection,
            namespace: process.env.TEMPORAL_NAMESPACE || 'default', // Ensure namespace is used
        });

        cachedTemporalClient = client;
        return client;
    } catch (error) {
        console.error('Failed to connect to Temporal:', error);
        throw error;
    }
}

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
        const supabase = getSupabase();
        let { organizationId, level = 7, iterations = 2500, batteries } = body;

        // 2. Organization-based Rate Limiting
        if (organizationId && !orgLimiter.check(organizationId)) {
            console.warn(`[Security] Rate limit exceeded for Organization: ${organizationId}`);
            return NextResponse.json(
                { success: false, error: 'Organization rate limit exceeded. Please try again in a minute.' },
                { status: 429 }
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

        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: 'organizationId is required' },
                { status: 400 }
            );
        }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Auth + Org Resolution
    // ═══════════════════════════════════════════════════════════════════

    if (!APEXGATE_DISABLED) {
        const authResult = await resolveCallerContext(request);

        if (!authResult.success) {
            return NextResponse.json(
                { success: false, error: authResult.error },
                { status: authResult.status }
            );
        }

        organizationId = authResult.context.orgId;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Check eligibility (including battery customization)
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

        const handle = await client.workflow.start(WORKFLOW_LEVEL_7, {
            workflowId,
            taskQueue: TASK_QUEUE_LEVEL_7,
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
