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
const BATTERY_HANDLERS: Record<string, (config: BatteryConfig) => Promise<BatteryResult>> = {
    B1: runBattery1_ChaosStress,
    B2: runBattery2_ChaosEngine,
    B3: runBattery3_PromptInjection,
    B4: runBattery4_SecurityAuth,
    B5: runBattery5_FullUnit,
    B6: runBattery6_UnsafeGate,
    B7: runBattery7_PlaywrightE2E,
    B8: runBattery8_AssetSmoke,
    B9: runBattery9_IntegrationHandshake,
    B10: runBattery10_GoalHijack,
    B11: runBattery11_ToolMisuse,
    B12: runBattery12_MemoryPoison,
    B13: runBattery13_SupplyChain,
    B14: runBattery14_IndirectInjection,
};

export async function BatteryChildWorkflow(batteryCode: string, config: BatteryConfig): Promise<BatteryResult> {
    let childCancelled = false;
    setHandler(cancelSignal, () => { childCancelled = true; });

    if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);

    const handler = BATTERY_HANDLERS[batteryCode];
    if (!handler) {
        throw new Error(`Unknown battery code: ${batteryCode}`);
    }

    if (childCancelled) throw new Error(`Battery ${batteryCode} cancelled`);
    return handler(config);
}

function resolveBatterySpecs(normalizedConfig: BatteryConfig): Array<{ code: string; id: string }> {
    const requestedCodes = (normalizedConfig.batteries && normalizedConfig.batteries.length > 0)
        ? normalizedConfig.batteries
        : DEFAULT_BATTERIES;

    return requestedCodes.map((code: string) => {
        const id = BATTERY_IDS[code as keyof typeof BATTERY_IDS];
        return { code, id: id || `${code}_UNKNOWN` };
    });
}

function mapSettledResults(
    settledResults: PromiseSettledResult<BatteryResult>[],
    batterySpecs: Array<{ code: string; id: string }>
): BatteryResult[] {
    return settledResults.map((result, index) => {
        const { id } = batterySpecs[index];
        if (result.status === 'fulfilled') {
            return result.value;
        }
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
    });
}

export async function ArmageddonLevel7Workflow(config: BatteryConfig): Promise<ArmageddonReport> {
    const normalizedIterations = normalizeIterations(config.iterations);
    const normalizedConfig: BatteryConfig = {
        ...config,
        iterations: normalizedIterations,
    };

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
        const batterySpecs = resolveBatterySpecs(normalizedConfig);

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

        const settledResults = await Promise.allSettled(
            batterySpecs.map((spec) => {
                if (cancelled) return Promise.reject(new Error('Cancelled before dispatch'));
                return executeChild(BatteryChildWorkflow, {
                    args: [spec.code, normalizedConfig],
                    workflowId: `${config.runId}-${spec.code}`,
                    workflowExecutionTimeout: TIMEOUTS.START_TO_CLOSE,
                });
            })
        );

        state.results = mapSettledResults(settledResults, batterySpecs);

        if (cancelled) {
            state.status = STATUS.CANCELLED;
        } else if (state.results.some(r => r.status === STATUS.FAILED)) {
            state.status = STATUS.FAILED;
        } else {
            state.status = STATUS.COMPLETED;
        }

        const report = await generateReport(state);

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
