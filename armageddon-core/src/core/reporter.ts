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

/**
 * SupabaseReporter - Pushes real-time events to Supabase for frontend consumption.
 */
export class SupabaseReporter {
    private readonly client: SupabaseClient;
    private readonly runId: string;

    constructor(runId: string) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('[Reporter] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
        }

        this.client = createClient(supabaseUrl, supabaseKey);
        this.runId = runId;
    }

    /**
     * Push an event to armageddon_events table.
     */
    async pushEvent(
        batteryId: string,
        eventType: EventType,
        payload?: Record<string, unknown>
    ): Promise<void> {
        const event: ArmageddonEvent = {
            runId: this.runId,
            batteryId,
            eventType,
            payload,
            timestamp: new Date().toISOString(),
        };

        const { error } = await this.client
            .from('armageddon_events')
            .insert(event);

        if (error) {
            console.error('[Reporter] Failed to push event:', error);
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

        const rows: ArmageddonEvent[] = events.map(e => ({
            runId: this.runId,
            batteryId: e.batteryId,
            eventType: e.eventType,
            payload: e.payload,
            timestamp: new Date().toISOString(),
        }));

        const { error } = await this.client
            .from('armageddon_events')
            .insert(rows);

        if (error) {
            console.error(`[Reporter] Failed to push ${events.length} events:`, error);
        }
    }

    /**
     * Upsert progress to armageddon_runs table (every N iterations).
     */
    async upsertProgress(progress: Omit<RunProgress, 'runId' | 'updatedAt'>): Promise<void> {
        const row: RunProgress = {
            ...progress,
            runId: this.runId,
            updatedAt: new Date().toISOString(),
        };

        const { error } = await this.client
            .from('armageddon_runs')
            .upsert(row, { onConflict: 'runId,batteryId' });

        if (error) {
            console.error('[Reporter] Failed to upsert progress:', error);
        }
    }

    /**
     * Mark run as completed with final stats.
     */
    async finalizeRun(
        status: 'COMPLETED' | 'FAILED',
        summary: Record<string, unknown>
    ): Promise<void> {
        await this.pushEvent('ORCHESTRATOR', status === 'COMPLETED' ? 'RUN_COMPLETED' : 'RUN_FAILED', summary);

        const { error } = await this.client
            .from('armageddon_runs')
            .update({
                status,
                completedAt: new Date().toISOString(),
                summary,
            })
            .eq('runId', this.runId);

        if (error) {
            console.error('[Reporter] Failed to finalize run:', error);
            throw new Error(`Failed to finalize run: ${error.message}`);
        }
    }
}

/**
 * Create a reporter instance for a run.
 */
export function createReporter(runId: string): SupabaseReporter {
    return new SupabaseReporter(runId);
}
