// armageddon-site/src/app/api/omniport/execute/route.ts
// POST /api/omniport/execute — OmniHub-triggered remote run. Mirrors /api/run auth path.
// Database migration: see telemetry/[runId]/route.ts for omniport_telemetry_events schema.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { guardOmniPort, isOmniPortEnabled, OmniPortExecuteRequestSchema, signTelemetryPayload } from '@/lib/omniport';

const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';

function deriveRunSeed(runId: string, organizationId: string): number {
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    return Number.parseInt(digest.slice(0, 8), 16);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = guardOmniPort(request);
    if (guard) return guard;

    // Zod-validate body
    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' },
            { status: 400 }
        );
    }

    const parsed = OmniPortExecuteRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, error: parsed.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' },
            { status: 400 }
        );
    }

    const { organizationId, level, iterations, batteries } = parsed.data;

    const runId = uuidv4();
    const workflowId = `armageddon-${runId}`;
    const seed = deriveRunSeed(runId, organizationId);
    const omniPortRunRef = `omniport-${organizationId}-${runId}`;

    const supabase = getSupabaseServiceRole();

    // Create run record in Supabase
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
                batteries: batteries ?? ['B10', 'B11', 'B12', 'B13', 'B14'],
                iterations,
                tier: 'CERTIFIED',
                seed,
                omniPortRunRef,
            },
        });

    if (insertError) {
        console.error('[OmniPort] Failed to create run record:', insertError.message);
        return NextResponse.json(
            { success: false, error: 'Failed to create run record', code: 'DB_INSERT_FAILED' },
            { status: 500 }
        );
    }

    // Start Temporal workflow — GATE G1: workflow must actually start
    let client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        console.error('[OmniPort] Temporal unavailable:', (err as Error).message);
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
                tier: 'CERTIFIED',
                seed,
                batteries: batteries ?? ['B10', 'B11', 'B12', 'B13', 'B14'],
            }],
        });
    } catch (err) {
        console.error('[OmniPort] Workflow start failed:', (err as Error).message);
        // Rollback pending run record status
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        return NextResponse.json(
            { success: false, error: 'Failed to start workflow', code: 'WORKFLOW_START_FAILED' },
            { status: 500 }
        );
    }

    // Update run with workflow execution ID
    await supabase
        .from('armageddon_runs')
        .update({
            workflow_run_id: handle.firstExecutionRunId,
            status: 'running',
            started_at: new Date().toISOString(),
        })
        .eq('id', runId);

    // Push run.started telemetry — GATE G3: telemetry delivery is the completion proof
    if (isOmniPortEnabled()) {
        try {
            const telemetryPayload = {
                eventType: 'run.started' as const,
                runId,
                orgId: organizationId,
                timestamp: Date.now(),
                payload: { workflowId, level, iterations, omniPortRunRef },
                signature: '',
            };
            const body = JSON.stringify(telemetryPayload);
            telemetryPayload.signature = signTelemetryPayload(body);

            const { error: telError } = await supabase.from('omniport_telemetry_events').insert({
                run_id: runId,
                org_id: organizationId,
                event_type: 'run.started',
                payload: telemetryPayload.payload,
                timestamp: telemetryPayload.timestamp,
            });
            if (telError) {
                console.warn('[OmniPort] Telemetry DB write failed (non-fatal):', telError.message);
            }
        } catch (err) {
            console.error('[OmniPort] Telemetry push error (non-fatal):', (err as Error).message);
        }
    }

    return NextResponse.json({
        success: true,
        runId,
        workflowId,
        omniPortRunRef,
    });
}
