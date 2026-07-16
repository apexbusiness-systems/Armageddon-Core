import { proxyActivities, defineSignal, setHandler, executeChild } from '@temporalio/workflow';
// Type-only import: Temporal's bundler elides `import type` declarations and does NOT
// follow this module into @armageddon/shared → gate.ts → @supabase/supabase-js.
// All runtime type contracts live in workflow-types.ts (zero external dependencies).
import type * as activities from './activities.js';
import type { BatteryConfig, WorkflowState, ArmageddonReport, BatteryResult } from './workflow-types.js';
import { normalizeIterations } from '@armageddon/shared/types';

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
    switch (batteryCode) {
        case 'B1': return runBattery1_ChaosStress(config);
        case 'B2': return runBattery2_ChaosEngine(config);
        case 'B3': return runBattery3_PromptInjection(config);
        case 'B4': return runBattery4_SecurityAuth(config);
        case 'B5': return runBattery5_FullUnit(config);
        case 'B6': return runBattery6_UnsafeGate(config);
        case 'B7': return runBattery7_PlaywrightE2E(config);
        case 'B8': return runBattery8_AssetSmoke(config);
        case 'B9': return runBattery9_IntegrationHandshake(config);
        case 'B10': return runBattery10_GoalHijack(config);
        case 'B11': return runBattery11_ToolMisuse(config);
        case 'B12': return runBattery12_MemoryPoison(config);
        case 'B13': return runBattery13_SupplyChain(config);
        case 'B14': return runBattery14_IndirectInjection(config);
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
        // Filter requested batteries. If none specified, use default subset (B10-B14).
        const requestedCodes = (normalizedConfig.batteries && normalizedConfig.batteries.length > 0)
            ? normalizedConfig.batteries
            : ['B10', 'B11', 'B12', 'B13', 'B14'];

        const batterySpecs = requestedCodes.map(code => {
            const id = BATTERY_IDS[code as keyof typeof BATTERY_IDS];
            return { code, id: id || `${code}_UNKNOWN` };
        });

        // 2. Execute Batteries via Child Workflows
        // We use Promise.allSettled to ensure that a single battery failure
        // does not crash the entire certification run.
        const settledResults = await Promise.allSettled(
            batterySpecs.map(spec => 
                executeChild(BatteryChildWorkflow, {
                    args: [spec.code, normalizedConfig],
                    workflowId: `${config.runId}-${spec.code}`,
                })
            )
        );

        state.results = settledResults.map((result, index) => {
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
