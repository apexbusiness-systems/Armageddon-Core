// src/core/reporter.ts
// ARMAGEDDON LEVEL 7 - REAL-TIME TELEMETRY
// APEX Business Systems Ltd.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageAdapter } from './storage/types';
import { SQLiteStorage } from './storage/sqlite';

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

// Internal Supabase Adapter
class SupabaseAdapter implements StorageAdapter {
    private client: SupabaseClient;

    constructor(url: string, key: string) {
        this.client = createClient(url, key);
    }

    async pushEvent(event: any): Promise<void> {
        const { error } = await this.client
            .from('armageddon_events')
            .insert(event);
        if (error) console.error('[Reporter] Failed to push event:', error);
    }

    async upsertRun(runData: any): Promise<void> {
        // Map fields to match Supabase schema if needed, or assume alignment
        // The table schema has columns like 'status', 'completed_at', 'summary'
        // But runData passed from UpsertProgress is partial.

        // This method handles both "progress upsert" and "run finalization" implicitly
        // depending on what's passed.
        // Actually, let's keep it simple: we just proxy the call.
        const { error } = await this.client
            .from('armageddon_runs')
            .upsert(runData, { onConflict: 'runId,batteryId' } as any); // Type assertion for flexibility

        if (error) console.error('[Reporter] Failed to upsert run:', error);
    }

    async getRun(runId: string): Promise<any> {
        const { data } = await this.client
            .from('armageddon_runs')
            .select('*')
            .eq('run_id', runId)
            .single();
        return data;
    }
}

// Global Singleton for SQLite (to persist across activity invocations in the same worker)
let globalSQLite: SQLiteStorage | null = null;

/**
 * Universal Reporter - Supports both Cloud (Supabase) and Local (SQLite) modes.
 */
export class Reporter {
    private readonly storage: StorageAdapter;
    private readonly runId: string;

    constructor(runId: string) {
        this.runId = runId;
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseKey) {
            this.storage = new SupabaseAdapter(supabaseUrl, supabaseKey);
        } else {
            // Use Singleton SQLite to simulate persistence in memory for this worker process
            if (!globalSQLite) {
                globalSQLite = new SQLiteStorage();
            }
            this.storage = globalSQLite;
        }
    }

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
        await this.storage.pushEvent(event);
    }

    async upsertProgress(progress: Omit<RunProgress, 'runId' | 'updatedAt'>): Promise<void> {
        const row: RunProgress = {
            ...progress,
            runId: this.runId,
            updatedAt: new Date().toISOString(),
        };
        // Note: Storage adapter must handle the specific schema differences if any.
        // For Supabase, it expects snake_case in some places, but we use an adapter.
        // For now, passing the object as-is.
        await this.storage.upsertRun(row);
    }

    async finalizeRun(
        status: 'COMPLETED' | 'FAILED',
        summary: Record<string, unknown>
    ): Promise<void> {
        await this.pushEvent('ORCHESTRATOR', status === 'COMPLETED' ? 'RUN_COMPLETED' : 'RUN_FAILED', summary);

        await this.storage.upsertRun({
            runId: this.runId,
            status,
            completedAt: new Date().toISOString(),
            summary
        });
    }
}

/**
 * Factory function
 */
export function createReporter(runId: string): Reporter {
    return new Reporter(runId);
}
