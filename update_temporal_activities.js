const fs = require('fs');
const file = 'armageddon-core/src/temporal/activities.ts';
let content = fs.readFileSync(file, 'utf8');

// Need to export runBattery14_IndirectInjection
// We'll wrap the logic from core/engine/activities.ts 

const newExport = `export async function runBattery14_IndirectInjection(config: BatteryConfig): Promise<BatteryResult> {
    const { runBattery14IndirectInjection } = await import('../core/engine/activities');
    const result = await runBattery14IndirectInjection(config.runId, {
        iterations: config.iterations,
        heartbeatInterval: Math.max(1, Math.floor(config.iterations / 10))
    });

    const passed = result.passed;
    return {
        batteryId: 'B14_INDIRECT_INJECTION',
        status: passed ? 'PASSED' : 'FAILED',
        iterations: result.iterations,
        blockedCount: result.blocked,
        breachCount: result.breaches,
        driftScore: result.escapeRate,
        duration: result.durationMs,
        details: { events: result.events.slice(-50) } // keep bounded
    };
}`;

content = content.replace(
    "export const activities = {",
    newExport + "\n\nexport const activities = {"
);

content = content.replace(
    "    runBattery13_SupplyChain,\n    generateReport,",
    "    runBattery13_SupplyChain,\n    runBattery14_IndirectInjection,\n    generateReport,"
);

fs.writeFileSync(file, content);
