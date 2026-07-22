// armageddon-site/src/app/api/omniport/execute/route.ts
// POST /api/omniport/execute — OmniHub-triggered remote run. Mirrors /api/run auth path.
// Database migration: see telemetry/[runId]/route.ts for omniport_telemetry_events schema.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getTemporalClient } from '@/lib/temporal';
import { getSupabaseServiceRole } from '@/lib/supabase';
import { guardOmniPort, isOmniPortEnabled, OmniPortExecuteRequestSchema, parseOmniPortBody, persistTelemetryEvent, deriveRunSeed, resolveOmniPortTaskQueue, type OmniPortExecuteRequest } from '@/lib/omniport';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = guardOmniPort(request);
    if (guard) return guard;

    const body = await parseOmniPortBody<OmniPortExecuteRequest>(request, OmniPortExecuteRequestSchema);
    if (body instanceof NextResponse) return body;
    const { organizationId, level, iterations, batteries, targetUrl } = body;

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
                // tier is 'FREE', not 'CERTIFIED': this endpoint always forces
                // sim_mode: true above (it has no waiver/live-fire-guard gate),
                // so its workflow must run the SimulationAdapter path honestly
                // rather than claim CERTIFIED tier for a run that can never be
                // live-fire (see packages/core/src/core/adversarial.ts, which
                // now throws for tier:'CERTIFIED' with no targetModel).
                tier: 'FREE',
                seed,
                omniPortRunRef,
                targetEndpoint: targetUrl,
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
            taskQueue: resolveOmniPortTaskQueue(organizationId),
            args: [{
                runId,
                organizationId,
                iterations,
                tier: 'FREE',
                seed,
                batteries: batteries ?? ['B10', 'B11', 'B12', 'B13', 'B14'],
                targetEndpoint: targetUrl,
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
        await persistTelemetryEvent(supabase, runId, organizationId, 'run.started', {
            workflowId, level, iterations, omniPortRunRef,
        });
    }

    return NextResponse.json({
        success: true,
        runId,
        workflowId,
        omniPortRunRef,
    });
}
