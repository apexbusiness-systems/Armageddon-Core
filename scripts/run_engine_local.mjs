import path from 'node:path';
import { fork } from 'node:child_process';
import { loadAtscEnv } from './load_env.mjs';

const fileEnv = loadAtscEnv();
const env = { ...process.env, ...fileEnv };

env.SIM_MODE = 'true';
env.SANDBOX_TENANT = 'armageddon-sandbox';
env.TEMPORAL_TASK_QUEUE = env.TEMPORAL_TASK_QUEUE || 'armageddon-certification';
env.ADMIN_EMAIL = env.ADMIN_EMAIL || 'jrmendozaceo@apexbusiness-systems.icu';
env.API_PORT = '8081';
env.WORKER_HEALTH_PORT = '8082';

console.log('[Runner] Starting Armageddon Local Engine with:');
console.log('  TEMPORAL_ADDRESS:', env.TEMPORAL_ADDRESS);
console.log('  TEMPORAL_NAMESPACE:', env.TEMPORAL_NAMESPACE);
console.log('  TEMPORAL_TASK_QUEUE:', env.TEMPORAL_TASK_QUEUE);
console.log('  SUPABASE_URL:', env.SUPABASE_URL);
console.log('  SIM_MODE:', env.SIM_MODE);
console.log('  SANDBOX_TENANT:', env.SANDBOX_TENANT);

const workerScript = path.resolve('packages/core/dist/worker.js');
const apiScript = path.resolve('packages/core/dist/api-server.js');

console.log('[Runner] Launching Worker...');
const workerProc = fork(workerScript, [], { env, stdio: 'inherit' });

console.log('[Runner] Launching API Server...');
const apiProc = fork(apiScript, [], { env, stdio: 'inherit' });

function cleanup() {
    console.log('[Runner] Shutting down...');
    workerProc.kill();
    apiProc.kill();
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
