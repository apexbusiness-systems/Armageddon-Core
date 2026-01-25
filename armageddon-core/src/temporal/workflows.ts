// src/temporal/workflows.ts
// ARMAGEDDON LEVEL 7 - TEMPORAL WORKFLOW DEFINITIONS
// APEX Business Systems Ltd.

import {
    proxyActivities,
    defineSignal,
    setHandler,
    condition,
    sleep,
    ApplicationFailure,
} from '@temporalio/workflow';

import type * as activitiesModule from './activities';
import type { BatteryResult, BatteryConfig } from './activities';

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_ITERATIONS = 10_000;
const CHECKPOINT_INTERVAL = 100;

// Proxy activities with appropriate timeouts
const activities = proxyActivities<typeof activitiesModule>({
    startToCloseTimeout: '30m', // God Mode batteries can run long
    retry: {
        maximumAttempts: 1, // Non-retryable for adversarial tests
        nonRetryableErrorTypes: ['SystemLockdownError'],
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS
// ═══════════════════════════════════════════════════════════════════════════

export const stopSequenceSignal = defineSignal<[]>('STOP_SEQUENCE');

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW STATE
// ═══════════════════════════════════════════════════════════════════════════

interface WorkflowState {
    runId: string;
    stopRequested: boolean;
    startedAt: string;
    completedBatteries: string[];
    results: BatteryResult[];
    status: 'RUNNING' | 'STOPPING' | 'COMPLETED' | 'FAILED';
}

// ═══════════════════════════════════════════════════════════════════════════
// ARMAGEDDON LEVEL 7 WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

export interface ArmageddonLevel7Input {
    runId: string;
    iterations?: number;
    targetEndpoint?: string;
    enabledBatteries?: string[];
}

export interface ArmageddonLevel7Output {
    runId: string;
    status: 'COMPLETED' | 'FAILED' | 'STOPPED';
    totalDuration: number;
    results: BatteryResult[];
    summary: {
        passed: number;
        failed: number;
        blocked: number;
        totalIterations: number;
        totalBreaches: number;
        avgDriftScore: number;
    };
}

/**
 * ArmageddonLevel7Workflow
 *
 * God Mode certification requiring 10,000 adversarial iterations
 * with an escape rate < 0.01%.
 *
 * Runs all 13 batteries concurrently using Promise.all.
 * Batteries 10-13 execute configurable iteration counts.
 */
export async function ArmageddonLevel7Workflow(
    input: ArmageddonLevel7Input
): Promise<ArmageddonLevel7Output> {
    const { runId, iterations = DEFAULT_ITERATIONS, targetEndpoint } = input;

    // Initialize state
    const state: WorkflowState = {
        runId,
        stopRequested: false,
        startedAt: new Date().toISOString(),
        completedBatteries: [],
        results: [],
        status: 'RUNNING',
    };

    // Register signal handler
    setHandler(stopSequenceSignal, () => {
        state.stopRequested = true;
        state.status = 'STOPPING';
    });

    const startTime = Date.now();

    // Battery configuration
    const config: BatteryConfig = {
        runId,
        iterations,
        targetEndpoint,
    };

    try {
        // ─────────────────────────────────────────────────────────────────────
        // PHASE 1: Run ALL batteries concurrently
        // ─────────────────────────────────────────────────────────────────────

        const batteryPromises = [
            // Baseline batteries (1-9)
            activities.runBattery1_ChaosStress(config),
            activities.runBattery2_ChaosEngine(config),
            activities.runBattery3_PromptInjection(config),
            activities.runBattery4_SecurityAuth(config),
            activities.runBattery5_FullUnit(config),
            activities.runBattery6_UnsafeGate(config),
            activities.runBattery7_PlaywrightE2E(config),
            activities.runBattery8_AssetSmoke(config),
            activities.runBattery9_IntegrationHandshake(config),

            // God Mode batteries (10-13) - 10,000 iterations
            activities.runBattery10_GoalHijack(config),
            activities.runBattery11_ToolMisuse(config),
            activities.runBattery12_MemoryPoison(config),
            activities.runBattery13_SupplyChain(config),
        ];

        // Execute all concurrently
        state.results = await Promise.all(batteryPromises);

        // Check if stop was requested during execution
        if (state.stopRequested) {
            state.status = 'COMPLETED'; // Still mark as completed if we finished
        } else {
            state.status = 'COMPLETED';
        }

        // ─────────────────────────────────────────────────────────────────────
        // PHASE 2: Aggregate results
        // ─────────────────────────────────────────────────────────────────────

        const summary = aggregateResults(state.results);

        return {
            runId,
            status: state.stopRequested ? 'STOPPED' : 'COMPLETED',
            totalDuration: Date.now() - startTime,
            results: state.results,
            summary,
        };
    } catch (error) {
        state.status = 'FAILED';

        // Re-throw with proper Temporal error type
        throw ApplicationFailure.create({
            type: 'ArmageddonExecutionFailure',
            message: error instanceof Error ? error.message : String(error),
            nonRetryable: true,
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function aggregateResults(results: BatteryResult[]): {
    passed: number;
    failed: number;
    blocked: number;
    totalIterations: number;
    totalBreaches: number;
    avgDriftScore: number;
} {
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let totalIterations = 0;
    let totalBreaches = 0;
    let totalDrift = 0;

    for (const result of results) {
        if (result.status === 'PASSED') passed++;
        else if (result.status === 'FAILED') failed++;
        else if (result.status === 'BLOCKED') blocked++;

        totalIterations += result.iterations;
        totalBreaches += result.breachCount;
        totalDrift += result.driftScore;
    }

    return {
        passed,
        failed,
        blocked,
        totalIterations,
        totalBreaches,
        avgDriftScore: totalDrift / results.length,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHILD WORKFLOWS (for isolation if needed)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SingleBatteryWorkflow - Run a single battery in isolation.
 * Useful for retesting specific batteries.
 */
export async function SingleBatteryWorkflow(
    runId: string,
    batteryId: string,
    iterations: number
): Promise<BatteryResult> {
    const config: BatteryConfig = { runId, iterations };

    const batteryMap: Record<string, () => Promise<BatteryResult>> = {
        B1: () => activities.runBattery1_ChaosStress(config),
        B2: () => activities.runBattery2_ChaosEngine(config),
        B3: () => activities.runBattery3_PromptInjection(config),
        B4: () => activities.runBattery4_SecurityAuth(config),
        B5: () => activities.runBattery5_FullUnit(config),
        B6: () => activities.runBattery6_UnsafeGate(config),
        B7: () => activities.runBattery7_PlaywrightE2E(config),
        B8: () => activities.runBattery8_AssetSmoke(config),
        B9: () => activities.runBattery9_IntegrationHandshake(config),
        B10: () => activities.runBattery10_GoalHijack(config),
        B11: () => activities.runBattery11_ToolMisuse(config),
        B12: () => activities.runBattery12_MemoryPoison(config),
        B13: () => activities.runBattery13_SupplyChain(config),
    };

    const runner = batteryMap[batteryId];
    if (!runner) {
        throw ApplicationFailure.create({
            type: 'InvalidBatteryId',
            message: `Unknown battery ID: ${batteryId}`,
            nonRetryable: true,
        });
    }

    return runner();
}
