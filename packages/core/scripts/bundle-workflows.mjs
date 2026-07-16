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
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowsPath = path.join(__dirname, '..', 'dist', 'temporal', 'workflows.js');
const outPath = path.join(__dirname, '..', 'dist', 'workflow-bundle.js');

const { code } = await bundleWorkflowCode({ workflowsPath });
const bundleBytes = Buffer.byteLength(code, 'utf8');
// Guard: bundle was 4.11 MB before the Supabase/gate.ts removal (2026-07-15).
// After removing @supabase from the workflow import chain the bundle is 1.39 MB.
// The limit is set to 2 MB — tight enough to catch @supabase re-entry (~845 KB),
// loose enough for normal Temporal SDK growth. If the guard fires at Docker build
// time, check that workflows.ts only imports from workflow-types.ts (not activities.ts
// barrel) and that @armageddon/shared is only imported via the /types subpath.
const maxBundleBytes = 2 * 1024 * 1024;


if (bundleBytes > maxBundleBytes) {
  throw new Error(
    `[bundle-workflows] Bundle is ${(bundleBytes / 1024 / 1024).toFixed(2)} MB; ` +
    `maximum is ${(maxBundleBytes / 1024 / 1024).toFixed(2)} MB. ` +
    'Check Temporal workflow imports for non-deterministic or server-only barrel dependencies.'
  );
}

await writeFile(outPath, code);
console.log(`[bundle-workflows] Wrote ${outPath} (${(bundleBytes / 1024 / 1024).toFixed(2)} MB)`);
