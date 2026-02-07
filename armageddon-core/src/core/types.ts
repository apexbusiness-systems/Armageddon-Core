// src/core/types.ts
// ARMAGEDDON Level 7 - Shared Core Types
// APEX Business Systems Ltd.
// DATE: 2026-02-06

/**
 * Organization tier for tiered feature access
 */
export type OrganizationTier = 'FREE' | 'CERTIFIED';

/**
 * Supported adversarial models
 */
export type AdversarialModel = 'sim-001' | 'gpt-4-turbo' | 'claude-3-opus' | 'llama-3-70b';

/**
 * Battery result status
 */
export type BatteryStatus = 'PASSED' | 'FAILED' | 'BLOCKED';

/**
 * Standard battery result interface
 */
export interface BatteryResult {
    batteryId: string;
    status: BatteryStatus;
    iterations: number;
    blockedCount: number;
    breachCount: number;
    driftScore: number;
    duration: number;
    details: Record<string, unknown>;
}

/**
 * Battery configuration
 */
export interface BatteryConfig {
    runId: string;
    iterations: number;
    tier: OrganizationTier;
    targetEndpoint?: string;
    targetModel?: AdversarialModel;
}

/**
 * Workflow execution state
 */
export interface WorkflowState {
    status: string;
    results: BatteryResult[];
    currentBattery: string | null;
    startTime: number;
}

/**
 * Final certification report
 */
export interface ArmageddonReport {
    meta: {
        timestamp: string;
        duration: number;
    };
    status: string;
    grade: string;
    score: number;
    batteries: BatteryResult[];
}
