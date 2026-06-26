// armageddon-site/src/app/api/omniport/live-fire/route.ts
// POST /api/omniport/live-fire — EXCLUSIVE SIM_MODE=false execution path.
// This is the ONLY route in the codebase that may authorize a live-fire Armageddon run.
//
// INVARIANT: enforceSafetyGuardLiveFire is private to this file.
// INVARIANT: enforceSafetyGuard() from safety.ts is NEVER called here — it would reject SIM_MODE=false.
// INVARIANT: No other file in the codebase may call enforceSafetyGuardLiveFire().
// Database migration: see waiver/route.ts for omniport_waiver_records schema.

export const runtime = 'nodejs';

import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import {
    guardOmniPort,
    verifyWaiverToken,
    parseOmniPortBody,
    persistTelemetryEvent,
    deriveRunSeed,
    OmniPortLiveFireRequestSchema,
    type OmniPortLiveFireRequest,
} from '@/lib/omniport';

// ─── Live-fire parallel guard ────────────────────────────────────────────────
// This guard is the ONLY authorization check that may bypass SIM_MODE.
// It does NOT call enforceSafetyGuard() — that function would throw on SIM_MODE=false.
// INVARIANT: enforceSafetyGuardLiveFire is private to this file.

function enforceSafetyGuardLiveFire(waiverRecordId: string): void {
    if (!process.env.OMNIPORT_LIVE_FIRE_SECRET) {
        throw new Error('LOCKDOWN: OMNIPORT_LIVE_FIRE_SECRET is not set — live-fire authorization denied');
    }
    if (!waiverRecordId) {
        throw new Error('LOCKDOWN: waiverRecordId is empty — live-fire authorization denied');
    }
    console.warn('[OmniPort LIVE-FIRE] Authorized run initiated:', waiverRecordId);
}

const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';

export async function POST(request: NextRequest): Promise<NextResponse> {
    // Step 1: OMNIPORT_ENABLED + HMAC bearer token auth
    const guard = guardOmniPort(request);
    if (guard) return guard;

    const body = await parseOmniPortBody<OmniPortLiveFireRequest>(request, OmniPortLiveFireRequestSchema);
    if (body instanceof NextResponse) return body;
    const { organizationId, waiverToken, level, iterations, batteries, targetUrl } = body;

    // Step 2: Validate OmniHub-issued waiver JWT
    const waiverPayload = verifyWaiverToken(waiverToken);
    if (!waiverPayload) {
        return NextResponse.json(
            { authorized: false, reason: 'WAIVER_TOKEN_INVALID_OR_EXPIRED' },
            { status: 401 }
        );
    }

    if (waiverPayload.orgId !== organizationId) {
        return NextResponse.json(
            { authorized: false, reason: 'WAIVER_ORG_MISMATCH' },
            { status: 400 }
        );
    }

    if (waiverPayload.runLevel !== level) {
        return NextResponse.json(
            { authorized: false, reason: 'WAIVER_LEVEL_MISMATCH' },
            { status: 400 }
        );
    }

    const supabase = getSupabaseServiceRole();

    // Step 3: Verify a persisted waiver record exists for this org + run level (not expired)
    const { data: waiverRecord, error: waiverError } = await supabase
        .from('omniport_waiver_records')
        .select('id, expires_at, waiver_token_hash')
        .eq('org_id', organizationId)
        .eq('run_level', level)
        .gte('expires_at', new Date().toISOString())
        .order('accepted_at', { ascending: false })
        .limit(1)
        .single();

    if (waiverError || !waiverRecord) {
        return NextResponse.json(
            { authorized: false, reason: 'WAIVER_RECORD_NOT_FOUND' },
            { status: 403 }
        );
    }

    const presentedHash = createHash('sha256').update(waiverToken).digest('hex');
    const presentedBuf = Buffer.from(presentedHash, 'utf8');
    const storedBuf = Buffer.from(waiverRecord.waiver_token_hash, 'utf8');

    if (presentedBuf.length !== storedBuf.length || !timingSafeEqual(presentedBuf, storedBuf)) {
        return NextResponse.json(
            { authorized: false, reason: 'WAIVER_TOKEN_HASH_MISMATCH' },
            { status: 403 }
        );
    }

    // Step 4: Parallel safety guard — INVARIANT: only called from this file
    try {
        enforceSafetyGuardLiveFire(waiverRecord.id);
    } catch (err) {
        return NextResponse.json(
            { authorized: false, reason: 'LIVE_FIRE_GUARD_FAILED', error: (err as Error).message },
            { status: 403 }
        );
    }

    const runId = uuidv4();
    const workflowId = `armageddon-lf-${runId}`;
    const seed = deriveRunSeed(runId, organizationId);
    const selectedBatteries = batteries ?? ['B10', 'B11', 'B12', 'B13', 'B14'];

    // Create live-fire run record
    const { error: insertError } = await supabase
        .from('armageddon_runs')
        .insert({
            id: runId,
            organization_id: organizationId,
            level,
            sim_mode: false,
            // armageddon_runs.sandbox_tenant is NOT NULL; live-fire runs are not
            // sandboxed, so we record an explicit authorized marker instead of null.
            sandbox_tenant: process.env.OMNIPORT_LIVE_FIRE_TENANT || 'live-fire-authorized',
            workflow_id: workflowId,
            status: 'pending',
            config: {
                batteries: selectedBatteries,
                iterations,
                tier: 'CERTIFIED',
                seed,
                liveFire: true,
                waiverRecordId: waiverRecord.id,
                targetUrl,
            },
        });

    if (insertError) {
        console.error('[OmniPort] Live-fire run record insert failed:', insertError.message);
        return NextResponse.json(
            { authorized: false, reason: 'DB_INSERT_FAILED', code: 'DB_INSERT_FAILED' },
            { status: 500 }
        );
    }

    // Step 5: Start Temporal workflow with CERTIFIED tier
    let client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        return NextResponse.json(
            { authorized: false, reason: 'TEMPORAL_UNAVAILABLE', code: 'TEMPORAL_UNAVAILABLE' },
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
                tier: 'CERTIFIED',
                seed,
                batteries: selectedBatteries,
                targetUrl,
            }],
        });
    } catch (err) {
        console.error('[OmniPort] Live-fire workflow start failed:', (err as Error).message);
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        return NextResponse.json(
            { authorized: false, reason: 'WORKFLOW_START_FAILED', code: 'WORKFLOW_START_FAILED' },
            { status: 500 }
        );
    }

    await supabase
        .from('armageddon_runs')
        .update({
            workflow_run_id: handle.firstExecutionRunId,
            status: 'running',
            started_at: new Date().toISOString(),
        })
        .eq('id', runId);

    // Step 6: Push live_fire.authorized telemetry — GATE G3: the event in the DB is the proof.
    // This is proof-critical: if it cannot be persisted we must NOT return authorized: true.
    try {
        await persistTelemetryEvent(supabase, runId, organizationId, 'live_fire.authorized', {
            workflowId, level, iterations, waiverRecordId: waiverRecord.id, liveFire: true,
        }, { required: true });
    } catch (err) {
        console.error('[OmniPort] Live-fire proof telemetry failed:', (err as Error).message);
        // The run already started; record it as failed and report the proof failure truthfully.
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        return NextResponse.json(
            { authorized: false, reason: 'PROOF_PERSIST_FAILED', code: 'PROOF_PERSIST_FAILED', runId },
            { status: 500 }
        );
    }

    return NextResponse.json({
        authorized: true,
        runId,
        workflowId,
        waiverRecordId: waiverRecord.id,
        liveFire: true,
    });
}
