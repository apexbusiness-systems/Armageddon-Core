// src/core/reporter.ts
// ARMAGEDDON LEVEL 7 - REAL-TIME TELEMETRY
// APEX Business Systems Ltd.
// OPTIMIZED: Singleton reporter cache — one Supabase client per run

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

// Module-level cache: one SupabaseReporter per runId.
// Avoids creating N Supabase clients (one per battery) for the same run.
const reporterCache = new Map<string, SupabaseReporter>();

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

        this.client = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
        });
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
        const event: ArmageddonEvent = {
            runId: this.runId,
            batteryId,
            eventType,
            payload,
            timestamp: new Date().toISOString(),
        };

        const [dbResult] = await Promise.all([
            this.client.from('armageddon_events').insert(event),
            this.channel.send({
                type: 'broadcast',
                event: 'armageddon_event',
                payload: event,
            })
        ]);

        if (dbResult.error) {
            console.error('[Reporter] Failed to push event:', dbResult.error);
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

        const [dbResult] = await Promise.all([
            this.client.from('armageddon_events').insert(rows),
            this.channel.send({
                type: 'broadcast',
                event: 'armageddon_event_batch',
                payload: { events: rows },
            })
        ]);

        if (dbResult.error) {
            console.error(`[Reporter] Failed to push ${events.length} events:`, dbResult.error);
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
        }
    }

    /**
     * Unsubscribe Supabase channel and remove from cache.
     * Call after finalizeRun to free resources.
     */
    dispose(): void {
        this.client.removeChannel(this.channel);
        reporterCache.delete(this.runId);
    }
}

/**
 * Get-or-create a cached reporter for this runId.
 * Ensures a single Supabase client per run regardless of how many batteries call it.
 */
export function createReporter(runId: string): SupabaseReporter {
    let reporter = reporterCache.get(runId);
    if (!reporter) {
        reporter = new SupabaseReporter(runId);
        reporterCache.set(runId, reporter);
    }
    return reporter;
}

/**
 * Evict and dispose the reporter for a completed run.
 */
export function clearReporter(runId: string): void {
    reporterCache.get(runId)?.dispose();
}
