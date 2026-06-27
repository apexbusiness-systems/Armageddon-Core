#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON — LEVEL INTEGRITY GATE
 * ───────────────────────────────────────────────────────────────────────────
 * Enforces that the certification-level CLAIM never drifts from the CAPABILITY.
 *
 * The single source of truth is packages/shared/src/levels.ts
 * (MAX_CERTIFICATION_LEVEL + derived TIER_LEVEL_ACCESS). The Cloudflare edge
 * Worker (armageddon-site/src/intake-handler.ts) cannot import that module, so
 * it keeps a hand-maintained MIRROR. This gate fails the build (exit 1) if:
 *
 *   1. the edge `certified` level list ≠ [1..MAX_CERTIFICATION_LEVEL]
 *   2. the edge `free_dry` / `verified` lists drift from the canonical boundaries
 *   3. the edge DEFAULT_BATTERIES ≠ shared DEFAULT_BATTERIES
 *   4. the README "[LEVEL N]" suite badge ≠ MAX_CERTIFICATION_LEVEL
 *
 * Deterministic, dependency-free source parsing — no build step required.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const failures = [];
const fail = (msg) => failures.push(msg);

const arrEq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const parseIntList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).map(Number);
const parseStrList = (s) => (s.match(/['"]([^'"]+)['"]/g) ?? []).map((m) => m.slice(1, -1));

// ── 1. Canonical source: MAX_CERTIFICATION_LEVEL ─────────────────────────────
const levelsSrc = read('packages/shared/src/levels.ts');
const maxMatch = /MAX_CERTIFICATION_LEVEL\s*=\s*(\d+)/.exec(levelsSrc);
if (!maxMatch) {
    fail('Could not find MAX_CERTIFICATION_LEVEL in packages/shared/src/levels.ts');
}
const MAX = maxMatch ? Number(maxMatch[1]) : NaN;
const canonicalCertified = Array.from({ length: MAX }, (_, i) => i + 1);

// ── 2. Canonical DEFAULT_BATTERIES (from shared gate) ────────────────────────
const gateSrc = read('packages/shared/src/gate.ts');
const sharedBatMatch = /DEFAULT_BATTERIES\s*=\s*\[([^\]]*)\]/.exec(gateSrc);
const sharedBatteries = sharedBatMatch ? parseStrList(sharedBatMatch[1]) : [];
if (!sharedBatteries.length) fail('Could not parse DEFAULT_BATTERIES from packages/shared/src/gate.ts');

// ── 3. Edge mirror (intake-handler.ts) ───────────────────────────────────────
const edgeSrc = read('armageddon-site/src/intake-handler.ts');
const edgeAccessBlock = /TIER_LEVEL_ACCESS[^{]*\{([\s\S]*?)\}/.exec(edgeSrc);
if (!edgeAccessBlock) {
    fail('Could not find TIER_LEVEL_ACCESS in armageddon-site/src/intake-handler.ts');
} else {
    const block = edgeAccessBlock[1];
    const pick = (tier) => {
        const m = new RegExp(`${tier}\\s*:\\s*\\[([0-9,\\s]+)\\]`).exec(block);
        return m ? parseIntList(m[1]) : null;
    };
    const edgeCertified = pick('certified');
    const edgeVerified = pick('verified');
    const edgeFree = pick('free_dry');

    if (!edgeCertified || !arrEq(edgeCertified, canonicalCertified)) {
        fail(`edge certified levels ${JSON.stringify(edgeCertified)} ≠ canonical [1..${MAX}] = ${JSON.stringify(canonicalCertified)}`);
    }
    if (!edgeVerified || !arrEq(edgeVerified, [1, 2, 3, 4, 5, 6])) {
        fail(`edge verified levels ${JSON.stringify(edgeVerified)} ≠ canonical [1..6]`);
    }
    if (!edgeFree || !arrEq(edgeFree, [1, 2, 3])) {
        fail(`edge free_dry levels ${JSON.stringify(edgeFree)} ≠ canonical [1..3]`);
    }
}

const edgeBatMatch = /DEFAULT_BATTERIES\s*=\s*\[([^\]]*)\]/.exec(edgeSrc);
const edgeBatteries = edgeBatMatch ? parseStrList(edgeBatMatch[1]) : [];
if (!arrEq(edgeBatteries, sharedBatteries)) {
    fail(`edge DEFAULT_BATTERIES ${JSON.stringify(edgeBatteries)} ≠ shared ${JSON.stringify(sharedBatteries)}`);
}

// ── 4. README suite badge "[LEVEL N]" must equal MAX ─────────────────────────
const readme = read('README.md');
const badge = /\[LEVEL\s+(\d+)\]/i.exec(readme);
if (badge && Number(badge[1]) !== MAX) {
    fail(`README "[LEVEL ${badge[1]}]" badge ≠ MAX_CERTIFICATION_LEVEL (${MAX})`);
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
    console.error('[LEVEL-INTEGRITY] ✖ Claim/capability drift detected:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\nFix: update the single source (packages/shared/src/levels.ts) and the edge mirror together.');
    process.exit(1);
}

console.log(`[LEVEL-INTEGRITY] ✓ MAX_CERTIFICATION_LEVEL=${MAX}; edge mirror, batteries, and README badge all consistent.`);
