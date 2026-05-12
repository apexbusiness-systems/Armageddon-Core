import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './temporal/activities';
import { safetyGuard } from './core/safety';
import { HealthServer } from './infrastructure/health';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RETRIES = 15;
const BASE_RETRY_MS = 1_000;   // Start at 1s
const MAX_RETRY_MS = 30_000;   // Cap at 30s

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH MONITORING
// ═══════════════════════════════════════════════════════════════════════════

const healthServer = new HealthServer(8081);
healthServer.start();

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION WITH EXPONENTIAL BACKOFF RETRY
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
            // Exponential backoff with jitter: 1s, 2s, 4s, 8s ... capped at 30s
            const backoffMs = Math.min(BASE_RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS);
            console.log(`[Worker] Waiting for Temporal... (retry in ${(backoffMs / 1000).toFixed(1)}s)`);
            await sleep(backoffMs);
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

    // 2. Connect to Temporal with exponential backoff retry
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
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';
    console.log('[Worker] Armageddon Level 7 Worker started. Ready for destruction.');
    console.log(`[Worker] PID: ${process.pid} | Node: ${process.version} | Queue: ${taskQueue}`);
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

// Run if executed directly (ESM top-level await replaced with IIFE for CJS compat)
if (require.main === module) {
   runWorker().catch((err) => {
       console.error(err);
       process.exit(1);
   });
}
