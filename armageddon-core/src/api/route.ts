// src/api/route.ts
// ARMAGEDDON LEVEL 7 - API TRIGGER
// Next.js API Route (App Router) / Vercel Edge Compatible
// APEX Business Systems Ltd.

import { NextRequest, NextResponse } from 'next/server';
import { Connection, Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import { safetyGuard, SystemLockdownError } from '../core/safety';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RunRequest {
    iterations?: number;
    targetEndpoint?: string;
    enabledBatteries?: string[];
}

interface RunResponse {
    runId: string;
    status: 'STARTED' | 'FAILED';
    message?: string;
    workflowId?: string;
}

interface StopRequest {
    runId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

function validateAuth(request: NextRequest): { valid: boolean; error?: string } {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
        return { valid: false, error: 'Missing Authorization header' };
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
        return { valid: false, error: 'Invalid auth scheme. Expected: Bearer' };
    }

    const expectedToken = process.env.APEX_SECRET;
    if (!expectedToken) {
        return { valid: false, error: 'APEX_SECRET not configured on server' };
    }

    if (token !== expectedToken) {
        return { valid: false, error: 'Invalid token' };
    }

    return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPORAL CLIENT
// ═══════════════════════════════════════════════════════════════════════════

async function getTemporalClient(): Promise<Client> {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

    const connection = await Connection.connect({
        address,
        // For Temporal Cloud, add TLS config:
        // tls: {
        //   clientCertPair: {
        //     crt: Buffer.from(process.env.TEMPORAL_TLS_CERT!, 'base64'),
        //     key: Buffer.from(process.env.TEMPORAL_TLS_KEY!, 'base64'),
        //   },
        // },
    });

    return new Client({
        connection,
        namespace,
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/run - Start Armageddon Run
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<RunResponse>> {
    // Step 1: Validate auth
    const authResult = validateAuth(request);
    if (!authResult.valid) {
        return NextResponse.json(
            { runId: '', status: 'FAILED', message: authResult.error },
            { status: 401 }
        );
    }

    // Step 2: Enforce safety locks BEFORE doing anything
    try {
        safetyGuard.enforce('API_RUN_TRIGGER');
    } catch (error) {
        if (error instanceof SystemLockdownError) {
            return NextResponse.json(
                { runId: '', status: 'FAILED', message: `[LOCKDOWN] ${error.message}` },
                { status: 403 }
            );
        }
        throw error;
    }

    // Step 3: Parse request body
    let body: RunRequest = {};
    try {
        body = await request.json();
    } catch {
        // Empty body is OK, use defaults
    }

    const runId = `AE-${uuidv4().slice(0, 8).toUpperCase()}`;
    const iterations = body.iterations ?? 10_000;

    // Step 4: Start Temporal workflow
    try {
        const client = await getTemporalClient();
        const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'armageddon-queue';

        const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            taskQueue,
            workflowId: runId,
            args: [
                {
                    runId,
                    iterations,
                    targetEndpoint: body.targetEndpoint,
                    enabledBatteries: body.enabledBatteries,
                },
            ],
        });

        return NextResponse.json({
            runId,
            status: 'STARTED',
            workflowId: handle.workflowId,
            message: `Armageddon Level 7 initiated. ${iterations.toLocaleString()} iterations per God Mode battery.`,
        });
    } catch (error) {
        console.error('[API] Failed to start workflow:', error);
        return NextResponse.json(
            {
                runId,
                status: 'FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/run - Stop Armageddon Run (STOP_SEQUENCE signal)
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    // Validate auth
    const authResult = validateAuth(request);
    if (!authResult.valid) {
        return NextResponse.json(
            { error: authResult.error },
            { status: 401 }
        );
    }

    // Parse body
    let body: StopRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Request body must contain runId' },
            { status: 400 }
        );
    }

    if (!body.runId) {
        return NextResponse.json(
            { error: 'runId is required' },
            { status: 400 }
        );
    }

    try {
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(body.runId);

        // Send STOP_SEQUENCE signal
        await handle.signal('STOP_SEQUENCE');

        return NextResponse.json({
            runId: body.runId,
            status: 'STOP_REQUESTED',
            message: 'STOP_SEQUENCE signal sent. Workflow will terminate gracefully.',
        });
    } catch (error) {
        console.error('[API] Failed to stop workflow:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/run - Get Run Status
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
    // Validate auth
    const authResult = validateAuth(request);
    if (!authResult.valid) {
        return NextResponse.json(
            { error: authResult.error },
            { status: 401 }
        );
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
        return NextResponse.json(
            { error: 'runId query parameter is required' },
            { status: 400 }
        );
    }

    try {
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(runId);

        const description = await handle.describe();

        return NextResponse.json({
            runId,
            workflowId: description.workflowId,
            status: description.status.name,
            startTime: description.startTime?.toISOString(),
            closeTime: description.closeTime?.toISOString(),
        });
    } catch (error) {
        console.error('[API] Failed to get workflow status:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
