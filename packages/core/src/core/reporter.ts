// src/core/reporter.ts
// ARMAGEDDON LEVEL 7 - REAL-TIME TELEMETRY
// APEX Business Systems Ltd.

import { SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseServiceRoleKey, readSupabaseUrl } from '@armageddon/shared';
import { createServerSupabaseClient } from './supabase-client.js';

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
    private readonly disabled: boolean;

    constructor(runId: string) {
        this.disabled = process.env.DISABLE_REPORTER === 'true';
        this.runId = runId;

        if (this.disabled) {
            console.warn(
                `[Reporter] ⚠️  TELEMETRY DISABLED for run ${runId} via DISABLE_REPORTER=true. ` +
                `NO events or progress will be written to armageddon_events/armageddon_runs. ` +
                `The frontend will show zero progress indefinitely. This warning repeats on every skipped write below.`
            );
            // @ts-expect-error - Next.js App Router context may not be available in CLI
            this.client = null;
            return;
        }

        const supabaseUrl = readSupabaseUrl();
        const supabaseKey = readSupabaseServiceRoleKey();

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('[Reporter] SUPABASE_URL (or ARMAGEDDON_DB_URL) and SUPABASE_SERVICE_ROLE_KEY (or ARMAGEDDON_DB_SERVICE_ROLE_KEY) required');
        }

        this.client = createServerSupabaseClient(supabaseUrl, supabaseKey);
    }

    /**
     * Push an event to armageddon_events table.
     */
    async pushEvent(
        batteryId: string,
        eventType: EventType,
        payload?: Record<string, unknown>
    ): Promise<void> {
        if (this.disabled) {
            console.warn(`[Reporter] SKIPPED event ${eventType} (battery ${batteryId}) for run ${this.runId} -- DISABLE_REPORTER=true.`);
            return;
        }
        const row = buildEventRow(this.runId, batteryId, eventType, payload, new Date().toISOString());

        // Single realtime transport: the durable insert IS the live signal. The
        // frontend consumes RLS-protected postgres_changes on armageddon_events,
        // so a separate channel broadcast would be redundant (and unauthenticated).
        const dbResult = await this.client.from('armageddon_events').insert(row);

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
        if (this.disabled) {
            console.warn(`[Reporter] SKIPPED batch of ${events.length} events for run ${this.runId} -- DISABLE_REPORTER=true.`);
            return;
        }
        if (events.length === 0) return;

        const createdAt = new Date().toISOString();
        const rows = events.map(e => buildEventRow(this.runId, e.batteryId, e.eventType, e.payload, createdAt));

        // Single realtime transport (see pushEvent): durable insert only.
        const dbResult = await this.client.from('armageddon_events').insert(rows);

        // Persistence is proof-critical: surface batch insert failures.
        if (dbResult.error) {
            throw new Error(`[Reporter] Failed to push ${events.length} events: ${dbResult.error.message}`);
        }
    }

    /**
     * Upsert progress to armageddon_runs table (every N iterations).
     */
    async upsertProgress(progress: Omit<RunProgress, 'runId' | 'updatedAt'>): Promise<void> {
        if (this.disabled) {
            console.warn(`[Reporter] SKIPPED progress upsert for run ${this.runId} -- DISABLE_REPORTER=true.`);
            return;
        }
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
        if (this.disabled) {
            console.warn(`[Reporter] SKIPPED finalizeRun (${status}) for run ${this.runId} -- DISABLE_REPORTER=true.`);
            return;
        }
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
