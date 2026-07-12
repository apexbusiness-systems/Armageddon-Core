#!/usr/bin/env node
// Pre-builds the Temporal workflow bundle at Docker BUILD time so the
// runtime worker process never has to load webpack + tapable + neo-async
// into its own heap on every container start.
//
// Without this, Worker.create({ workflowsPath }) triggers an in-process
// webpack compile on every boot (~23s, 4.11MB bundle observed 2026-07-10)
// -- webpack's own toolchain sits resident in the same 512MB free-tier
// container as the actual Temporal polling loop. Pre-bundling moves that
// one-time cost to the Docker build stage, where it's free and irrelevant.
//
// Official pattern: https://docs.temporal.io/typescript/production-deploy#pre-build-code
import { bundleWorkflowCode } from '@temporalio/worker';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowsPath = path.join(__dirname, '..', 'dist', 'temporal', 'workflows.js');
const outPath = path.join(__dirname, '..', 'dist', 'workflow-bundle.js');

// ── Ceiling and contamination config ──────────────────────────────────────────
// Verified clean bundle: ~1.39 MB (2026-07-10).
// Contaminated bundle (Supabase pulled via shared barrel): ~4.12 MB.
// 3 MiB ceiling gives headroom while blocking the known regression.
// Update this constant only with a reviewed baseline change.
const MAX_BUNDLE_BYTES = 3 * 1024 * 1024; // 3 MiB

// String markers that indicate server-only contamination in the bundle output.
// These should never appear in deterministic Temporal workflow code.
const CONTAMINATION_MARKERS = [
  '@supabase/supabase-js',
  'supabase/functions-js',
];

const { code } = await bundleWorkflowCode({ workflowsPath });

// ── Size gate ─────────────────────────────────────────────────────────────────
const bundleBytes = Buffer.byteLength(code, 'utf8');
if (bundleBytes > MAX_BUNDLE_BYTES) {
  console.error(
    `[bundle-workflows] REJECTED — bundle is ${(bundleBytes / 1024 / 1024).toFixed(2)} MiB; ` +
    `maximum is ${(MAX_BUNDLE_BYTES / 1024 / 1024).toFixed(2)} MiB.\n` +
    'This usually means a server-only barrel import (e.g. @armageddon/shared instead of\n' +
    '@armageddon/shared/types) pulled Supabase or similar deps into workflow code.\n' +
    'Check src/temporal/workflows.ts imports and re-run after fixing.'
  );
  process.exit(1);
}

// ── Contamination scan ────────────────────────────────────────────────────────
for (const marker of CONTAMINATION_MARKERS) {
  if (code.includes(marker)) {
    console.error(
      `[bundle-workflows] REJECTED — contamination marker found in bundle: "${marker}"\n` +
      'Server-only dependencies must not appear in Temporal workflow bundles.\n' +
      'Check src/temporal/workflows.ts imports.'
    );
    process.exit(1);
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────
await writeFile(outPath, code);

const sha256 = createHash('sha256').update(code, 'utf8').digest('hex');
console.log(
  `[bundle-workflows] Wrote ${outPath}\n` +
  `  size:   ${bundleBytes} bytes (${(bundleBytes / 1024 / 1024).toFixed(2)} MiB)\n` +
  `  sha256: ${sha256}`
);

