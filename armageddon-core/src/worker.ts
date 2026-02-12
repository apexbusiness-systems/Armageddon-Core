import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './temporal/activities';
import { safetyGuard } from './core/safety';
import { HealthServer } from './infrastructure/health';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RETRIES = 15;
const RETRY_INTERVAL_MS = 2000;

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH MONITORING
// ═══════════════════════════════════════════════════════════════════════════

const healthServer = new HealthServer(8081);
healthServer.start();

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION WITH RETRY
// ═══════════════════════════════════════════════════════════════════════════

async function connectWithRetry(): Promise<NativeConnection> {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Worker] Connecting to Temporal at ${address} (attempt ${attempt}/${MAX_RETRIES})...`);
            const connection = await NativeConnection.connect({ address });
            console.log('[Worker] Connected to Temporal successfully.');
            healthServer.setTemporalConnected(true);
            return connection;
        } catch (err) {
            healthServer.setTemporalConnected(false);
            if (attempt === MAX_RETRIES) {
                console.error(`[Worker] Failed to connect after ${MAX_RETRIES} attempts. Exiting.`);
                throw err;
            }
            console.log(`[Worker] Waiting for Temporal... (retry in ${RETRY_INTERVAL_MS / 1000}s)`);
            await sleep(RETRY_INTERVAL_MS);
        }
    }

    // Unreachable, but TypeScript needs it
    throw new Error('Connection failed');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

export async function createArmageddonWorker(): Promise<Worker> {
    // 1. Verify Environment Safety
    try {
        safetyGuard.enforce('WorkerStartup');
        console.log('[Worker] Safety checks passed. SIM_MODE=true verified.');
    } catch (err) {
        console.error('[Worker] SAFETY LOCKDOWN. REFUSING TO START.');
        console.error(err);
        healthServer.setWorkerState('STOPPED');
        process.exit(1);
    }

    // 2. Connect to Temporal with retry
    const connection = await connectWithRetry();

    // 3. Register Worker
    const worker = await Worker.create({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7',
        workflowsPath: require.resolve('./temporal/workflows'),
        activities: activities.activities,
    });

    healthServer.setWorkerState('RUNNING');

    return worker;
}

export async function runWorker() {
    const worker = await createArmageddonWorker();
    console.log('[Worker] Armageddon Level 7 Worker started. Ready for destruction.');
    console.log('[Worker] Health Monitor: http://localhost:8081/health');
    await worker.run();
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Worker] SIGTERM received. Initiating graceful shutdown...');
    healthServer.setWorkerState('DRAINING');
    healthServer.stop();
    process.exit(0);
});

// Run if executed directly (ESM top-level await)
if (import.meta.url === `file://${process.argv[1]}`) {
    runWorker().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
