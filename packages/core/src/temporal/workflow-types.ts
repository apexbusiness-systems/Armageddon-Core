// src/temporal/workflow-types.ts
// ARMAGEDDON LEVEL 7 - WORKFLOW-SAFE TYPE BOUNDARY
// APEX Business Systems Ltd.
//
// PURPOSE: Isolate the types that workflows.ts needs from activities.ts.
// Temporal's bundleWorkflowCode follows ALL import chains and includes
// everything it finds in the workflow bundle (loaded into a V8 deterministic
// sandbox on every workflow replay). activities.ts imports @armageddon/shared
// which re-exports gate.ts → @supabase/supabase-js (845KB). That Supabase
// code has no business in the workflow sandbox — it belongs in activities only.
//
// Rule: this file MUST have zero runtime imports. Types only. No I/O.
// Temporal's sandbox cannot call Supabase — it would throw at runtime anyway.
//
// INVARIANT: Keep in sync with the matching interfaces in activities.ts.
// If you add a field to BatteryConfig or BatteryResult in activities.ts,
// mirror it here. A typecheck failure is the intended signal.

export type OrganizationTier = 'FREE' | 'CERTIFIED';
export type AdversarialModel = 'sim-001' | 'gpt-4-turbo' | 'claude-3-opus' | 'llama-3-70b';

export interface BatteryConfig {
    runId: string;
    iterations: number;
    tier: OrganizationTier;
    targetEndpoint?: string;
    targetModel?: AdversarialModel;
    seed?: number;
    batteries?: string[];
    /** Certification level (1-8). Recorded into the signed report/receipt. */
    level?: number;
}

export interface BatteryResult {
    batteryId: string;
    status: 'PASSED' | 'FAILED' | 'BLOCKED';
    iterations: number;
    blockedCount: number;
    breachCount: number;
    driftScore: number;
    duration: number;
    details: Record<string, unknown>;
}

export interface WorkflowState {
    status: string;
    results: BatteryResult[];
    currentBattery: string | null;
    startTime: number;
    level?: number;
}

export interface ArmageddonReport {
    meta: {
        timestamp: string;
        duration: number;
    };
    status: string;
    grade: string;
    score: number;
    /** Certification level (1-8) this run was executed at. Signed into the receipt. */
    level?: number;
    batteries: BatteryResult[];
}
