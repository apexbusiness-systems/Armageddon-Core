import { proxyActivities, defineSignal, setHandler, executeChild } from '@temporalio/workflow';
// Type-only import: Temporal's bundler elides `import type` declarations and does NOT
// follow this module into @armageddon/shared → gate.ts → @supabase/supabase-js.
// All runtime type contracts live in workflow-types.ts (zero external dependencies).
import type * as activities from './activities.js';
import type { BatteryConfig, WorkflowState, ArmageddonReport, BatteryResult } from './workflow-types.js';
import { normalizeIterations, DEFAULT_BATTERIES } from '@armageddon/shared/types';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TIMEOUTS = {
    START_TO_CLOSE: '10m', // 10 minutes per battery
    WORKFLOW_EXECUTION: '1h', // 1 hour total
} as const;

export const BATTERY_IDS = {
    B1: 'B1_CHAOS_STRESS',
    B2: 'B2_CHAOS_ENGINE',
    B3: 'B3_PROMPT_INJECTION',
    B4: 'B4_SECURITY_AUTH',
    B5: 'B5_FULL_UNIT',
    B6: 'B6_UNSAFE_GATE',
    B7: 'B7_PLAYWRIGHT_E2E',
    B8: 'B8_ASSET_SMOKE',
    B9: 'B9_INTEGRATION_HANDSHAKE',
    B10: 'B10_GOAL_HIJACK',
    B11: 'B11_TOOL_MISUSE',
    B12: 'B12_MEMORY_POISON',
    B13: 'B13_SUPPLY_CHAIN',
    B14: 'B14_INDIRECT_INJECTION',
} as const;

const STATUS = {
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
} as const;

// Define Activity Options
const {
    runBattery1_ChaosStress,
    runBattery2_ChaosEngine,
    runBattery3_PromptInjection,
    runBattery4_SecurityAuth,
    runBattery5_FullUnit,
    runBattery6_UnsafeGate,
    runBattery7_PlaywrightE2E,
    runBattery8_AssetSmoke,
    runBattery9_IntegrationHandshake,
    runBattery10_GoalHijack,
    runBattery11_ToolMisuse,
    runBattery12_MemoryPoison,
    runBattery13_SupplyChain,
    runBattery14_IndirectInjection,
    generateReport,
    finalizeRunActivity
} = proxyActivities<typeof activities>({
    startToCloseTimeout: TIMEOUTS.START_TO_CLOSE,
});

// Map the workflow's internal uppercase status to the lowercase run_status enum
// persisted in armageddon_runs (pending | running | passed | failed | cancelled).
const TERMINAL_STATUS_MAP: Record<string, 'passed' | 'failed' | 'cancelled'> = {
    [STATUS.COMPLETED]: 'passed',
    [STATUS.FAILED]: 'failed',
    [STATUS.CANCELLED]: 'cancelled',
};

// Signals
export const cancelSignal = defineSignal('cancel');

/**
 * Child Workflow to encapsulate a single battery's execution.
 * This bounds the event history of the parent workflow, crucial for high-iteration
 * adversarial batteries that might otherwise hit Temporal's 50k event limit.
 */
export async function BatteryChildWorkflow(batteryCode: string, config: BatteryConfig): Promise<BatteryResult> {
    let childCancelled = false;
    setHandler(cancelSignal, () => { childCancelled = true; });

    if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);

    switch (batteryCode) {
        case 'B1':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery1_ChaosStress(config);
        case 'B2':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery2_ChaosEngine(config);
        case 'B3':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery3_PromptInjection(config);
        case 'B4':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery4_SecurityAuth(config);
        case 'B5':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery5_FullUnit(config);
        case 'B6':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery6_UnsafeGate(config);
        case 'B7':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery7_PlaywrightE2E(config);
        case 'B8':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery8_AssetSmoke(config);
        case 'B9':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery9_IntegrationHandshake(config);
        case 'B10':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery10_GoalHijack(config);
        case 'B11':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery11_ToolMisuse(config);
        case 'B12':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery12_MemoryPoison(config);
        case 'B13':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery13_SupplyChain(config);
        case 'B14':
            if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
            return runBattery14_IndirectInjection(config);
        default:
            throw new Error(`Unknown battery code: ${batteryCode}`);
    }
}

export async function ArmageddonLevel7Workflow(config: BatteryConfig): Promise<ArmageddonReport> {
    // Normalize iterations at the workflow boundary
    const normalizedIterations = normalizeIterations(config.iterations);
    
    // Create normalized config
    const normalizedConfig: BatteryConfig = {
        ...config,
        iterations: normalizedIterations,
    };

    // 1. Initialize State
    let cancelled = false;
    setHandler(cancelSignal, () => { cancelled = true; });

    const state: WorkflowState = {
        status: STATUS.RUNNING,
        results: [],
        currentBattery: null,
        startTime: Date.now(),
        level: normalizedConfig.level,
    };

    try {
        // Filter requested batteries. If none specified, use default battery set.
        const requestedCodes = (normalizedConfig.batteries && normalizedConfig.batteries.length > 0)
            ? normalizedConfig.batteries
            : DEFAULT_BATTERIES;

        const batterySpecs = requestedCodes.map((code: string) => {
            const id = BATTERY_IDS[code as keyof typeof BATTERY_IDS];
            return { code, id: id || `${code}_UNKNOWN` };
        });

        // Check for pre-execution cancellation BEFORE fanning out
        if (cancelled) {
            state.status = STATUS.CANCELLED;
            const report = await generateReport(state);
            await finalizeRunActivity({
                runId: config.runId,
                status: 'cancelled',
                startedAt: state.startTime,
                report,
            });
            return report;
        }

        // 2. Execute Batteries via Child Workflows
        // We use Promise.allSettled to ensure that a single battery failure
        // does not crash the entire certification run.
        const settledResults = await Promise.allSettled(
            batterySpecs.map((spec: { code: string; id: string }) => {
                if (cancelled) return Promise.reject(new Error('Cancelled before dispatch'));
                return executeChild(BatteryChildWorkflow, {
                    args: [spec.code, normalizedConfig],
                    workflowId: `${config.runId}-${spec.code}`,
                    workflowExecutionTimeout: TIMEOUTS.START_TO_CLOSE,
                });
            })
        );

        state.results = settledResults.map((result: PromiseSettledResult<BatteryResult>, index: number) => {
            const { id } = batterySpecs[index];

            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                // Handle rejected promise - create a FAILED battery result
                const errorMessage = result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason);

                return {
                    batteryId: id,
                    status: STATUS.FAILED,
                    iterations: 0,
                    blockedCount: 0,
                    breachCount: 0,
                    driftScore: 0,
                    duration: 0,
                    details: {
                        error: errorMessage,
                        logs: [`CRITICAL FAILURE: ${errorMessage}`],
                    },
                };
            }
        });

        // 3. Aggregate Results
        const failureCount = state.results.filter(r => r.status === STATUS.FAILED).length;

        // Final Status Determination
        if (cancelled) {
            state.status = STATUS.CANCELLED;
        } else if (failureCount > 0) {
            state.status = STATUS.FAILED;
        } else {
            state.status = STATUS.COMPLETED;
        }

        // 4. Generate Final Report
        const report = await generateReport(state);

        // 5. Persist terminal state — DURABLE PROOF. If this throws, the workflow
        // fails and never reports success without a finalized row in the database.
        await finalizeRunActivity({
            runId: config.runId,
            status: TERMINAL_STATUS_MAP[state.status] ?? 'failed',
            startedAt: state.startTime,
            report,
        });

        return report;

    } catch (err) {
        state.status = STATUS.FAILED;
        throw err;
    }
}
