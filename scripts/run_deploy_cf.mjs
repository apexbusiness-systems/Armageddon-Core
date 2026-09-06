import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const envFilePath = process.env.ATSC_ENV_PATH || 'C:/Users/sinyo/Desktop/ENV/ATSC-env.md';
const env = { ...process.env };
if (fs.existsSync(envFilePath)) {
    const content = fs.readFileSync(envFilePath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        let key = trimmed.slice(0, eqIdx).trim().replace(/\\/g, '');
        let val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '').replace(/\\/g, '');
        env[key] = val;
    }
}

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
