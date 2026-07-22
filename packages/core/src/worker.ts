import { Worker, NativeConnection } from '@temporalio/worker';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import * as activities from './temporal/activities.js';
import { SafetyGuard } from './core/safety.js';
import { getAttestationPublicKey } from './core/attestation.js';
import { HealthServer } from './infrastructure/health.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RETRIES = 15;
const RETRY_INTERVAL_MS = 2000;
let _workerRef: Worker | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH MONITORING
// ═══════════════════════════════════════════════════════════════════════════

const healthServer = new HealthServer(Number(process.env.WORKER_HEALTH_PORT ?? '8082'));
healthServer.start();

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION WITH RETRY
// ═══════════════════════════════════════════════════════════════════════════

async function connectWithRetry(): Promise<NativeConnection> {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    // Temporal Cloud (and any TLS-terminated cluster, e.g. a shared cluster an
    // operator's Moat worker connects out to) requires an API key + TLS. Local
    // dev against the bundled docker-compose.moat.yml `temporal` service has
    // neither set, so this is a no-op there — same plaintext connection as before.
    const apiKey = process.env.TEMPORAL_API_KEY || undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Worker] Connecting to Temporal at ${address} (attempt ${attempt}/${MAX_RETRIES})...`);
            const connection = await NativeConnection.connect({
                address,
                ...(apiKey ? { apiKey, tls: true } : {}),
            });
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
        const safetyGuard = SafetyGuard.getInstance();
        safetyGuard.enforce('WorkerStartup');
        console.log('[Worker] Safety checks passed. SIM_MODE=true verified.');
    } catch (err) {
        console.error('[Worker] SAFETY LOCKDOWN. REFUSING TO START.');
        console.error(err);
        healthServer.setWorkerState('STOPPED');
        process.exit(1);
    }

    // 1b. Report attestation key state at boot so operators can immediately
    //     see whether certificates will carry a stable verification key
    //     (env-seeded) or a per-process key (ephemeral). Public key only —
    //     the seed never leaves process memory.
    try {
        const attest = getAttestationPublicKey();
        if (attest.source === 'env') {
            console.log(`[Worker] Attestation: spec=${attest.spec} algorithm=${attest.algorithm} keyId=${attest.keyId} source=env`);
        } else {
            console.warn(`[Worker] Attestation: spec=${attest.spec} algorithm=${attest.algorithm} keyId=${attest.keyId} source=EPHEMERAL — set ARMAGEDDON_ATTESTATION_SEED for stable public-key publishing.`);
        }
    } catch (err) {
        console.error('[Worker] Failed to derive attestation key:', err instanceof Error ? err.message : err);
        healthServer.setWorkerState('STOPPED');
        process.exit(1);
    }

    // 2. Connect to Temporal with retry
    const connection = await connectWithRetry();

    // 3. Register Worker
    // Prefer a pre-built bundle (dist/workflow-bundle.js, produced at Docker
    // build time by `npm run bundle:workflows` -- see scripts/bundle-workflows.mjs)
    // so the runtime worker process never loads webpack in-process (23s/4.11MB
    // in-process compile observed 2026-07-10, contributing to the worker's
    // OOM against its 512MB free-tier budget). Falls back to dynamic
    // workflowsPath bundling when no prebuilt bundle exists, i.e. local
    // `tsx`/`tsx watch` dev, where this file's extension is still .ts.
    const selfPath = fileURLToPath(import.meta.url);
    const prebuiltBundlePath = fileURLToPath(new URL('./workflow-bundle.js', import.meta.url));
    const workflowsExt = selfPath.endsWith('.ts') ? 'ts' : 'js';
    const worker = await Worker.create({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7',
        ...(existsSync(prebuiltBundlePath)
            ? { workflowBundle: { codePath: prebuiltBundlePath } }
            : { workflowsPath: fileURLToPath(new URL(`./temporal/workflows.${workflowsExt}`, import.meta.url)) }),
        activities: activities.activities,
    });

    healthServer.setWorkerState('RUNNING');
    _workerRef = worker;

    return worker;
}

export async function runWorker() {
    const worker = await createArmageddonWorker();
    _workerRef = worker;
    console.log('[Worker] Armageddon Level 7 Worker started. Ready for destruction.');
    console.log('[Worker] Health Monitor: http://localhost:8081/health');
    await worker.run();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM received. Initiating graceful shutdown...');
    healthServer.setWorkerState('DRAINING');
    try {
        if (_workerRef) {
            await _workerRef.shutdown();
        }
    } catch (err) {
        console.error('[Worker] Shutdown error:', err);
    } finally {
        healthServer.stop();
        process.exit(0);
    }
});

// Run if executed directly. ESM has no require.main/module; compare this module's
// URL to the invoked entrypoint (node dist/worker.js) instead.
const isDirectRun = process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
if (isDirectRun) {
    try {
        await runWorker();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
