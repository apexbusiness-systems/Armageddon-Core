import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './temporal/activities';
import { safetyGuard } from './core/safety';

async function run() {
    // 1. Verify Environment Safety
    try {
        safetyGuard.enforce('WorkerStartup');
        console.log('[Worker] Safety checks passed. SIM_MODE=true verified.');
    } catch (err) {
        console.error('[Worker] SAFETY LOCKDOWN. REFUSING TO START.');
        console.error(err);
        process.exit(1);
    }

    // 2. Connect to Temporal
    console.log('[Worker] Connecting to Temporal...');
    const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    // 3. Register Worker
    const worker = await Worker.create({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7',
        workflowsPath: require.resolve('./temporal/workflows'),
        activities: activities.activities,
    });

    // 4. Run
    console.log('[Worker] Armageddon Level 7 Worker started. Ready for destruction.');
    await worker.run();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
