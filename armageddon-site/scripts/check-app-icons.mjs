/**
 * Strict validation of all generated app icons.
 *
 * Checks: file existence, non-zero size, correct dimensions.
 * Exits non-zero on any failure. Logs each check.
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const publicDir = path.join(siteRoot, 'public');

let failures = 0;

function pass(msg) {
    process.stdout.write(`[PASS] ${msg}\n`);
}

function fail(msg) {
    process.stderr.write(`[FAIL] ${msg}\n`);
    failures++;
}

async function checkPng(relPath, expectedW, expectedH) {
    const absPath = path.join(publicDir, relPath);
    process.stdout.write(`[CHK]  ${relPath}\n`);

    if (!existsSync(absPath)) {
        fail(`Missing: ${absPath}`);
        return;
    }
    const stat = statSync(absPath);
    if (stat.size === 0) {
        fail(`Zero bytes: ${absPath}`);
        return;
    }
    let meta;
    try {
        meta = await sharp(absPath).metadata();
    } catch (err) {
        fail(`Cannot read PNG metadata (${absPath}): ${err instanceof Error ? err.message : String(err)}`);
        return;
    }
    if (meta.width !== expectedW || meta.height !== expectedH) {
        fail(`Wrong dimensions ${meta.width}×${meta.height} (expected ${expectedW}×${expectedH}): ${absPath}`);
        return;
    }
    pass(`${relPath} — ${meta.width}×${meta.height}`);
}

function checkIco(relPath) {
    const absPath = path.join(publicDir, relPath);
    process.stdout.write(`[CHK]  ${relPath}\n`);

    if (!existsSync(absPath)) {
        fail(`Missing: ${absPath}`);
        return;
    }
    const stat = statSync(absPath);
    if (stat.size === 0) {
        fail(`Zero bytes: ${absPath}`);
        return;
    }
    pass(`${relPath} — exists and non-empty (${stat.size} bytes)`);
}

// ─── Run checks ──────────────────────────────────────────────────────────────

await checkPng('icon.png', 512, 512);
await checkPng('apple-touch-icon.png', 180, 180);
await checkPng(path.join('icons', 'icon-192.png'), 192, 192);
await checkPng(path.join('icons', 'icon-512.png'), 512, 512);
await checkPng(path.join('icons', 'icon-maskable-192.png'), 192, 192);
await checkPng(path.join('icons', 'icon-maskable-512.png'), 512, 512);
await checkPng(path.join('icons', 'store', 'app-store-icon-1024.png'), 1024, 1024);
await checkPng(path.join('icons', 'store', 'play-store-icon-512.png'), 512, 512);
checkIco('favicon.ico');

// ─── Summary ─────────────────────────────────────────────────────────────────

if (failures > 0) {
    process.stderr.write(`\n[FAIL] ${failures} check(s) failed.\n`);
    process.exit(1);
} else {
    process.stdout.write('\n[PASS] All icon checks passed.\n');
}
