// armageddon-site/src/app/api/omniport/live-fire/route.ts
// POST /api/omniport/live-fire — EXCLUSIVE SIM_MODE=false execution path.
// This is the ONLY route in the codebase that may authorize a live-fire Armageddon run.
//
// INVARIANT: enforceSafetyGuardLiveFire is private to this file.
// INVARIANT: enforceSafetyGuard() from safety.ts is NEVER called here — it would reject SIM_MODE=false.
// INVARIANT: No other file in the codebase may call enforceSafetyGuardLiveFire().
//
// DATABASE MIGRATION (run once against Supabase):
// CREATE TABLE IF NOT EXISTS omniport_waiver_records (
//   id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   org_id            TEXT NOT NULL,
//   user_id           TEXT NOT NULL,
//   waiver_version    TEXT NOT NULL DEFAULT '1.0',
//   waiver_token_hash TEXT NOT NULL,
//   run_level         INTEGER NOT NULL,
//   accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
//   expires_at        TIMESTAMPTZ NOT NULL,
//   created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_omniport_waiver_org ON omniport_waiver_records(org_id, run_level, expires_at);

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import {
    verifyOmniPortToken,
    isOmniPortEnabled,
    verifyWaiverToken,
    signTelemetryPayload,
    OmniPortLiveFireRequestSchema,
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

function deriveRunSeed(runId: string, organizationId: string): number {
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    return Number.parseInt(digest.slice(0, 8), 16);
}

const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isOmniPortEnabled()) {
        return NextResponse.json(
            { success: false, error: 'OmniPort connector is disabled on this instance', code: 'OMNIPORT_DISABLED' },
            { status: 503 }
        );
    }

    // Step 1: HMAC bearer token auth
    if (!verifyOmniPortToken(request)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' },
            { status: 400 }
        );
    }

    const parsed = OmniPortLiveFireRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, error: parsed.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' },
            { status: 400 }
        );
    }

    const { organizationId, waiverToken, level, iterations, batteries } = parsed.data;

    // Step 2: Validate OmniHub-issued waiver JWT
    const waiverPayload = verifyWaiverToken(waiverToken);
    if (!waiverPayload) {
        return NextResponse.json(
            { authorized: false, reason: 'WAIVER_TOKEN_INVALID_OR_EXPIRED' },
            { status: 401 }
        );
    }

    const supabase = getSupabaseServiceRole();

    // Step 3: Verify a persisted waiver record exists for this org + run level (not expired)
    const { data: waiverRecord, error: waiverError } = await supabase
        .from('omniport_waiver_records')
        .select('id, expires_at')
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
            sandbox_tenant: null,
            workflow_id: workflowId,
            status: 'pending',
            config: {
                batteries: selectedBatteries,
                iterations,
                tier: 'CERTIFIED',
                seed,
                liveFire: true,
                waiverRecordId: waiverRecord.id,
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

    // Step 6: Push live_fire.authorized telemetry — GATE G3: event in DB is the proof
    try {
        const telemetryPayload = {
            eventType: 'live_fire.authorized' as const,
            runId,
            orgId: organizationId,
            timestamp: Date.now(),
            payload: {
                workflowId,
                level,
                iterations,
                waiverRecordId: waiverRecord.id,
                liveFire: true,
            },
            signature: '',
        };
        const body = JSON.stringify(telemetryPayload);
        telemetryPayload.signature = signTelemetryPayload(body);

        const { error: telError } = await supabase.from('omniport_telemetry_events').insert({
            run_id: runId,
            org_id: organizationId,
            event_type: 'live_fire.authorized',
            payload: telemetryPayload.payload,
            timestamp: telemetryPayload.timestamp,
        });
        if (telError) {
            console.warn('[OmniPort] Live-fire telemetry DB write failed (non-fatal):', telError.message);
        }
    } catch (err) {
        console.error('[OmniPort] Live-fire telemetry error (non-fatal):', (err as Error).message);
    }

    return NextResponse.json({
        authorized: true,
        runId,
        workflowId,
        waiverRecordId: waiverRecord.id,
        liveFire: true,
    });
}
