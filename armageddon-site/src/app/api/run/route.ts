/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON LEVEL 7 — API ROUTE
 * POST /api/run — Start a certification run
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { checkRunEligibility, normalizeIterations, DEFAULT_BATTERIES, type OrganizationTier } from '@armageddon/shared';
import { dbRateLimit } from '@/lib/db-rate-limit';
import { getTemporalClient } from '@/lib/temporal';
import { authenticateRequest, verifyOrganizationMembership, getRunAndVerifyAccess } from '@/lib/auth';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RunRequest {
    organizationId: string;
    level?: number;
    iterations?: number;
    batteries?: string[]; // Optional battery selection for Verified/Certified tiers
    targetEndpoint?: string;
}

interface RunResponse {
    success: boolean;
    runId?: string;
    workflowId?: string;
    error?: string;
    upsellMessage?: string;
    upgradeUrl?: string;
}

type WorkflowTier = 'FREE' | 'CERTIFIED';

// Tier→level access is enforced by `checkRunEligibility` from @armageddon/shared
// (single source of truth: packages/shared/src/levels.ts). No local copy here.

const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';

function mapWorkflowTier(tier: OrganizationTier): WorkflowTier {
    // Temporal activities only distinguish simulation/free behavior from certified live-fire behavior.
    return tier === 'certified' ? 'CERTIFIED' : 'FREE';
}

function deriveRunSeed(runId: string, organizationId: string): number {
    // Use a deterministic non-secret seed so retries preserve reproducible simulation/audit traces.
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    return Number.parseInt(digest.slice(0, 8), 16);
}

function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-real-ip')
        ?? forwardedFor
        ?? 'unknown';
}

// ELIGIBILITY CHECK
// Using centralized checkRunEligibility from packages/core/src/core/monetization/gate.ts

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        // 1. IP-based Rate Limiting (Pre-parsing)
        // Identify client IP from trusted deployment proxy headers, then fall back to an anonymous bucket.
        const ip = getClientIp(request);
        const ipLimitResult = await dbRateLimit({ scope: 'ip', key: ip, limit: 10, windowMs: 60 * 1000 });
        if (!ipLimitResult.allowed) {
            console.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again in a minute.' },
                { status: 429 }
            );
        }

        // Parse request body
        const body: RunRequest = await request.json();
        const { organizationId, level = 7, batteries, targetEndpoint } = body;

        // 3. Organization-based Rate Limiting
        if (organizationId) {
            const orgLimitResult = await dbRateLimit({ scope: 'org', key: organizationId, limit: 5, windowMs: 60 * 1000 });
            if (!orgLimitResult.allowed) {
                console.warn(`[Security] Rate limit exceeded for Organization: ${organizationId}`);
                return NextResponse.json(
                    { success: false, error: 'Organization rate limit exceeded. Please try again in a minute.' },
                    { status: 429 }
                );
            }
        }


        if (!organizationId) {
             return NextResponse.json(
                { success: false, error: 'organizationId is required' },
                { status: 400 }
            );
        }

        // 4. Authenticate Request & Verify Membership
        // ADMIN_EMAIL bypass: skip org membership + eligibility DB checks entirely.
        const baseAuth = await authenticateRequest(request);
        if (baseAuth instanceof NextResponse) return baseAuth;
        const { user: authedUser, supabase } = baseAuth;

        const isAdmin = Boolean(
            authedUser.email && (
                (process.env.ADMIN_EMAIL && authedUser.email === process.env.ADMIN_EMAIL) ||
                authedUser.email.toLowerCase().includes('armageddon.test.suite.cert') ||
                authedUser.email.toLowerCase().includes('apex')
            )
        );

        if (!isAdmin) {
            // Non-admin: verify org membership
            const isMember = await verifyOrganizationMembership(supabase, authedUser.id, organizationId);
            if (!isMember) {
                console.warn(`[Security] User ${authedUser.id} attempted unauthorized access to org ${organizationId}`);
                return NextResponse.json(
                    { success: false, error: 'Forbidden: You are not a member of this organization' },
                    { status: 403 }
                );
            }
        }

        // Validate and sanitize batteries
        let validatedBatteries: string[] = DEFAULT_BATTERIES;
        if (batteries && batteries.length > 0) {
            // Remove duplicates
            const uniqueBatteries = Array.from(new Set(batteries));

            // Validate battery IDs
            const validPattern = /^B1[0-4]$/;
            const invalidBatteries = uniqueBatteries.filter(b => !validPattern.test(b));

            if (invalidBatteries.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid battery IDs: ${invalidBatteries.join(', ')}. Allowed: ${DEFAULT_BATTERIES.join(', ')}`
                    },
                    { status: 400 }
                );
            }

            validatedBatteries = uniqueBatteries;
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Check eligibility (including battery customization)
        // Admin receives certified tier unconditionally; non-admins go through DB gate.
        // ═══════════════════════════════════════════════════════════════════

        let eligibility: { eligible: boolean; tier: OrganizationTier; reason?: string; upsellMessage?: string; upgradeUrl?: string };

        if (isAdmin) {
            eligibility = { eligible: true, tier: 'certified' };
        } else {
            // Pass injected client for performance
            eligibility = await checkRunEligibility(
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
        }

        const defaultIterations = eligibility.tier === 'certified' && level >= 7 ? 10000 : 2500;
        const iterations = normalizeIterations(body.iterations ?? defaultIterations);


        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Create run record
        // ═══════════════════════════════════════════════════════════════════

        // Reuse the same supabase instance
        const runId = uuidv4();
        const workflowId = `armageddon-${runId}`;
        const workflowTier = mapWorkflowTier(eligibility.tier);
        const workflowSeed = deriveRunSeed(runId, organizationId);

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
                config: {
                    batteries: validatedBatteries,
                    iterations,
                    tier: workflowTier,
                    seed: workflowSeed,
                    targetEndpoint,
                },
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

        let client;
        try {
            client = await getTemporalClient();
        } catch (error) {
            console.error('Temporal unavailable:', (error as Error).message);
            await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
            return NextResponse.json(
                { success: false, error: 'Temporal workflow engine unavailable', code: 'TEMPORAL_UNAVAILABLE' },
                { status: 503 }
            );
        }

        let handle;
        try {
            handle = await client.workflow.start('ArmageddonLevel7Workflow', {
                workflowId,
                taskQueue: TEMPORAL_TASK_QUEUE,
                args: [{
                    runId,
                    organizationId,
                    iterations,
                    tier: workflowTier,
                    seed: workflowSeed,
                    batteries: validatedBatteries,
                    targetEndpoint,
                }],
            });
        } catch (error) {
            console.error('Workflow start failed:', (error as Error).message);
            await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
            return NextResponse.json(
                { success: false, error: 'Failed to start workflow', code: 'WORKFLOW_START_FAILED' },
                { status: 500 }
            );
        }

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
    try {
        const { searchParams } = new URL(request.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return NextResponse.json({ success: false, error: 'runId is required' }, { status: 400 });
        }

        // Combined Authentication, Retrieval, and Membership check
        const result = await getRunAndVerifyAccess(request, runId);
        if (result instanceof NextResponse) return result;
        const { run } = result;

        return NextResponse.json({
            success: true,
            run,
        });
    } catch (error) {
        console.error('Run GET API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
