import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadAtscEnv } from './load_env.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fileEnv = loadAtscEnv();
const env = { ...process.env, ...fileEnv };

env.CLOUDFLARE_ZONE_ID = '66184cc82aa7d87f2628eff0f882a4fe';
env.CLOUDFLARE_ZONE_NAME = 'armageddontest.icu';
env.CLOUDFLARE_CANONICAL_HOST = 'armageddontest.icu';
env.CLOUDFLARE_SKIP_MIGRATION_CHECK = 'true';
env.CLOUDFLARE_INCLUDE_WWW = 'false';
env.ADMIN_EMAIL = env.ADMIN_EMAIL || 'armageddon.test.suite.cert@gmail.com';

const deployScript = path.join(repoRoot, 'scripts', 'deploy_cloudflare_static.mjs');
console.log('[Deploy] Starting Cloudflare static bundle deployment...');

const child = fork(deployScript, [], {
    cwd: repoRoot,
    env,
    stdio: 'inherit'
});

child.on('exit', (code) => {
    console.log(`[Deploy] deploy_cloudflare_static.mjs exited with code ${code}`);
    process.exit(code ?? 1);
});
