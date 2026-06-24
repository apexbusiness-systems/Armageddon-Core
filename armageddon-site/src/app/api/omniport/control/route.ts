// armageddon-site/src/app/api/omniport/control/route.ts
// POST /api/omniport/control — Hot-edit: injects an OmniPort control signal into an active Temporal workflow.
//
// UNCERTAIN: [signal-handler] — ArmageddonLevel7Workflow in workflows.ts currently only handles the
// 'cancel' signal. The 'omniport.control' signal will be sent (Temporal buffers it), but the workflow
// will not act on it until a setHandler(omniportControlSignal, ...) is added to the workflow code.
// This file cannot touch workflows.ts per mission constraints. The signal mechanism is wired; the
// handler side must be added to the workflow to make hot-edit actionable end-to-end.

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal';
import { guardOmniPort, OmniPortControlCommandSchema, parseOmniPortBody, type OmniPortControlCommand } from '@/lib/omniport';

// WorkflowNotFoundError from @temporalio/client — we check by name for forward-compat
function isWorkflowNotFound(err: unknown): boolean {
    if (err instanceof Error) {
        return err.constructor.name === 'WorkflowNotFoundError' ||
               err.message.includes('workflow not found') ||
               err.message.includes('Workflow not found');
    }
    return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = guardOmniPort(request);
    if (guard) return guard;

    const command = await parseOmniPortBody<OmniPortControlCommand>(request, OmniPortControlCommandSchema);
    if (command instanceof NextResponse) return command;
    // Derive workflowId from runId — same convention as /api/run route
    const workflowId = `armageddon-${command.runId}`;

    let client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        return NextResponse.json(
            { success: false, error: 'Temporal workflow engine unavailable', code: 'TEMPORAL_UNAVAILABLE' },
            { status: 503 }
        );
    }

    // Only 'cancel' has a workflow handler (cancelSignal). All other commands are
    // delivered to the buffered 'omniport.control' signal but the workflow does not
    // act on them yet — we report that truthfully via `actionable` instead of
    // claiming a no-op succeeded.
    const isCancel = command.command === 'cancel';

    try {
        const handle = client.workflow.getHandle(workflowId);
        if (isCancel) {
            await handle.signal('cancel');
        } else {
            await handle.signal('omniport.control', command);
        }
    } catch (err) {
        if (isWorkflowNotFound(err)) {
            return NextResponse.json(
                { acknowledged: false, error: 'RUN_NOT_FOUND', code: 'RUN_NOT_FOUND' },
                { status: 404 }
            );
        }
        console.error('[OmniPort] Control signal failed:', (err as Error).message);
        return NextResponse.json(
            { success: false, error: 'Failed to signal workflow', code: 'SIGNAL_FAILED' },
            { status: 500 }
        );
    }

    if (isCancel) {
        return NextResponse.json({
            acknowledged: true,
            actionable: true,
            runId: command.runId,
            command: command.command,
            signalledAt: Date.now(),
        });
    }

    return NextResponse.json({
        acknowledged: true,
        actionable: false,
        runId: command.runId,
        command: command.command,
        note: `'${command.command}' signal delivered but the workflow handler is not yet implemented`,
        signalledAt: Date.now(),
    }, { status: 202 });
}
