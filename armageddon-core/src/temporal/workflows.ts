import { proxyActivities, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';
import { BatteryConfig, WorkflowState, ArmageddonReport } from './activities';
import { normalizeIterations } from '@armageddon/shared';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TIMEOUTS = {
    START_TO_CLOSE: '10m', // 10 minutes per battery
    WORKFLOW_EXECUTION: '1h', // 1 hour total
} as const;

const BATTERY_IDS = {
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
    generateReport
} = proxyActivities<typeof activities>({
    startToCloseTimeout: TIMEOUTS.START_TO_CLOSE,
});

// Signals
export const cancelSignal = defineSignal('cancel');

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
    };

    try {
        // 2. Execute Batteries (Parallel Resiliency)
        // We use Promise.allSettled to ensure that a single battery failure
        // does not crash the entire certification run.

        const batterySpecs = [
            { id: BATTERY_IDS.B1, run: runBattery1_ChaosStress },
            { id: BATTERY_IDS.B2, run: runBattery2_ChaosEngine },
            { id: BATTERY_IDS.B3, run: runBattery3_PromptInjection },
            { id: BATTERY_IDS.B4, run: runBattery4_SecurityAuth },
            { id: BATTERY_IDS.B5, run: runBattery5_FullUnit },
            { id: BATTERY_IDS.B6, run: runBattery6_UnsafeGate },
            { id: BATTERY_IDS.B7, run: runBattery7_PlaywrightE2E },
            { id: BATTERY_IDS.B8, run: runBattery8_AssetSmoke },
            { id: BATTERY_IDS.B9, run: runBattery9_IntegrationHandshake },
            { id: BATTERY_IDS.B10, run: runBattery10_GoalHijack },
            { id: BATTERY_IDS.B11, run: runBattery11_ToolMisuse },
            { id: BATTERY_IDS.B12, run: runBattery12_MemoryPoison },
            { id: BATTERY_IDS.B13, run: runBattery13_SupplyChain },
        ];

        // Execute all concurrently with resilience
        const settledResults = await Promise.allSettled(
            batterySpecs.map(spec => spec.run(normalizedConfig))
        );

        state.results = settledResults.map((result, index) => {
            const batteryId = batterySpecs[index].id;

            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                // Handle rejected promise - create a FAILED battery result
                const errorMessage = result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason);

                return {
                    batteryId,
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
        // totalDuration calculation removed as it was unused

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
        return report;

    } catch (err) {
        state.status = STATUS.FAILED;
        throw err;
    }
}
