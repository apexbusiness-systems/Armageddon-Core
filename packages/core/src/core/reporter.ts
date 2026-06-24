// src/core/reporter.ts
// ARMAGEDDON LEVEL 7 - REAL-TIME TELEMETRY
// APEX Business Systems Ltd.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type EventType =
    | 'RUN_STARTED'
    | 'BATTERY_STARTED'
    | 'BATTERY_COMPLETED'
    | 'ATTACK_BLOCKED'
    | 'BREACH'
    | 'DRIFT_DETECTED'
    | 'ITERATION_CHECKPOINT'
    | 'RUN_COMPLETED'
    | 'RUN_FAILED'
    | 'LOCKDOWN';

export interface ArmageddonEvent {
    runId: string;
    batteryId: string;
    eventType: EventType;
    payload?: Record<string, unknown>;
    timestamp: string;
}

export interface RunProgress {
    runId: string;
    batteryId: string;
    currentIteration: number;
    totalIterations: number;
    blockedCount: number;
    breachCount: number;
    driftScore: number;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    updatedAt: string;
}

// armageddon_events.severity is the event_severity enum: info | warning | critical | blocked.
type EventSeverity = 'info' | 'warning' | 'critical' | 'blocked';

const SEVERITY_MAP: Record<EventType, EventSeverity> = {
    RUN_STARTED: 'info',
    BATTERY_STARTED: 'info',
    BATTERY_COMPLETED: 'info',
    ATTACK_BLOCKED: 'blocked',
    BREACH: 'critical',
    DRIFT_DETECTED: 'warning',
    ITERATION_CHECKPOINT: 'info',
    RUN_COMPLETED: 'info',
    RUN_FAILED: 'critical',
    LOCKDOWN: 'critical',
};

// armageddon_events.message is NOT NULL. Derive a safe, non-secret summary —
// never serialize raw payloads or secrets into the message column.
function deriveMessage(eventType: EventType, payload?: Record<string, unknown>): string {
    const base = eventType.toLowerCase().replaceAll('_', ' ');
    const detailRaw = payload?.batteryId ?? payload?.reason ?? payload?.status ?? payload?.runId;
    // Only stringify primitives — never let an object fall through to '[object Object]'.
    const detail = (typeof detailRaw === 'string' || typeof detailRaw === 'number')
        ? String(detailRaw).slice(0, 120)
        : '';
    return detail ? `${base}: ${detail}` : base;
}

// armageddon_events row, snake_case, schema-aligned. iteration is NOT NULL → default 0.
function buildEventRow(
    runId: string,
    batteryId: string,
    eventType: EventType,
    payload: Record<string, unknown> | undefined,
    createdAt: string
) {
    const iterationRaw = payload?.iteration;
    const iteration = typeof iterationRaw === 'number' && Number.isFinite(iterationRaw) ? iterationRaw : 0;
    return {
        run_id: runId,
        battery_id: batteryId,
        iteration,
        severity: SEVERITY_MAP[eventType] ?? 'info',
        event_type: eventType,
        message: deriveMessage(eventType, payload),
        payload: payload ?? {},
        created_at: createdAt,
    };
}

/**
 * SupabaseReporter - Pushes real-time events to Supabase for frontend consumption.
 */
export class SupabaseReporter {
    private readonly client: SupabaseClient;
    private readonly runId: string;
    private readonly channel: ReturnType<SupabaseClient['channel']>;

    constructor(runId: string) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('[Reporter] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
        }

        this.client = createClient(supabaseUrl, supabaseKey);
        this.runId = runId;
        this.channel = this.client.channel(`run_telemetry_${runId}`);
    }

    /**
     * Push an event to armageddon_events table.
     */
    async pushEvent(
        batteryId: string,
        eventType: EventType,
        payload?: Record<string, unknown>
    ): Promise<void> {
        const row = buildEventRow(this.runId, batteryId, eventType, payload, new Date().toISOString());

        const [dbResult] = await Promise.all([
            this.client.from('armageddon_events').insert(row),
            this.channel.send({
                type: 'broadcast',
                event: 'armageddon_event',
                payload: row,
            })
        ]);

        // Persistence is proof-critical: surface insert failures instead of swallowing them.
        if (dbResult.error) {
            throw new Error(`[Reporter] Failed to push event ${eventType}: ${dbResult.error.message}`);
        }
    }

    /**
     * Push multiple events to armageddon_events table in a single batch.
     */
    async pushEvents(
        events: Array<{
            batteryId: string;
            eventType: EventType;
            payload?: Record<string, unknown>;
        }>
    ): Promise<void> {
        if (events.length === 0) return;

        const createdAt = new Date().toISOString();
        const rows = events.map(e => buildEventRow(this.runId, e.batteryId, e.eventType, e.payload, createdAt));

        const [dbResult] = await Promise.all([
            this.client.from('armageddon_events').insert(rows),
            this.channel.send({
                type: 'broadcast',
                event: 'armageddon_event_batch',
                payload: { events: rows },
            })
        ]);

        // Persistence is proof-critical: surface batch insert failures.
        if (dbResult.error) {
            throw new Error(`[Reporter] Failed to push ${events.length} events: ${dbResult.error.message}`);
        }
    }

    /**
     * Upsert progress to armageddon_runs table (every N iterations).
     */
    async upsertProgress(progress: Omit<RunProgress, 'runId' | 'updatedAt'>): Promise<void> {
        // Progress (not terminal proof) → update real snake_case columns on the run row
        // keyed by id. Non-fatal: log on error, never corrupt the run record.
        const escapeRate = progress.totalIterations > 0
            ? progress.breachCount / progress.totalIterations
            : 0;

        const { error } = await this.client
            .from('armageddon_runs')
            .update({
                total_iterations: progress.totalIterations,
                breaches: progress.breachCount,
                escape_rate: escapeRate,
            })
            .eq('id', this.runId);

        if (error) {
            console.error('[Reporter] Failed to upsert progress:', error.message);
        }
    }

    /**
     * Mark run as completed with final stats. Status is mapped to the lowercase
     * run_status enum at this write boundary. Throws on failure (proof-critical).
     */
    async finalizeRun(
        status: 'COMPLETED' | 'FAILED',
        summary: Record<string, unknown>
    ): Promise<void> {
        const terminalStatus = status === 'COMPLETED' ? 'passed' : 'failed';
        await this.pushEvent('SYSTEM', status === 'COMPLETED' ? 'RUN_COMPLETED' : 'RUN_FAILED', summary);

        const { error } = await this.client
            .from('armageddon_runs')
            .update({
                status: terminalStatus,
                completed_at: new Date().toISOString(),
            })
            .eq('id', this.runId);

        if (error) {
            throw new Error(`[Reporter] Failed to finalize run: ${error.message}`);
        }
    }
}

/**
 * Create a reporter instance for a run.
 */
export function createReporter(runId: string): SupabaseReporter {
    return new SupabaseReporter(runId);
}
