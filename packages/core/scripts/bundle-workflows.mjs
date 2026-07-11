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
await writeFile(outPath, code);
console.log(`[bundle-workflows] Wrote ${outPath} (${(code.length / 1024 / 1024).toFixed(2)} MB)`);
