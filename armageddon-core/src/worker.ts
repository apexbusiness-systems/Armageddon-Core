import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './temporal/activities';
import { safetyGuard } from './core/safety';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RETRIES = 15;
const RETRY_INTERVAL_MS = 2000;

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
            return connection;
        } catch (err) {
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

    return worker;
}

export async function runWorker() {
    const worker = await createArmageddonWorker();
    console.log('[Worker] Armageddon Level 7 Worker started. Ready for destruction.');
    await worker.run();
}

// Check if running directly (ESM context check)
// In Node, we can check if file is executed directly.
import { fileURLToPath } from 'url';

// For CommonJS/ESM compatibility in TSX
// This check might need adjustment depending on environment, but simple check works for now
if (import.meta.url && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() || '')) {
    // Only run if filename matches (rough check)
    // Better: use explicit flag or different entry point.
    // But for now, let's assume if it's main module.
    // Actually, createWorker is exported, runWorker is exported.
    // If run as script:
    // await runWorker();
}

// Just run if executed directly:
if (import.meta.url === `file://${process.argv[1]}`) {
     runWorker().catch(err => {
         console.error(err);
         process.exit(1);
     });
}
