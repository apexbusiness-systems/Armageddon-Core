#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const bundleScriptPath = 'packages/core/scripts/bundle-workflows.mjs';
const dockerfiles = [
  'packages/core/Dockerfile',
  'packages/core/Dockerfile.api',
];

const fail = (message) => {
  console.error(`[DOCKER-CONTRACT] ${message}`);
  process.exitCode = 1;
};

await access(bundleScriptPath).catch(() => fail(`Missing source file: ${bundleScriptPath}`));

const corePackage = JSON.parse(await readFile('packages/core/package.json', 'utf8'));
if (corePackage.scripts?.['bundle:workflows'] !== 'node scripts/bundle-workflows.mjs') {
  fail('armageddon-core bundle:workflows must execute node scripts/bundle-workflows.mjs');
}

const acceptedCopyPatterns = [
  /COPY\s+packages\/core\/scripts\/bundle-workflows\.mjs\s+\.\/packages\/core\/scripts\/bundle-workflows\.mjs/,
  /COPY\s+packages\/core\/scripts\s+\.\/packages\/core\/scripts/,
];

for (const dockerfile of dockerfiles) {
  const text = await readFile(dockerfile, 'utf8');
  const runIndex = text.indexOf('npm run bundle:workflows -w armageddon-core');
  if (runIndex < 0) {
    fail(`${dockerfile} no longer invokes the workflow bundler; review the runtime contract explicitly.`);
    continue;
  }

  const copyMatch = acceptedCopyPatterns
    .map((pattern) => pattern.exec(text))
    .find(Boolean);

  if (!copyMatch || copyMatch.index > runIndex) {
    fail(`${dockerfile} must COPY ${bundleScriptPath} before invoking bundle:workflows.`);
    continue;
  }

  console.log(`[DOCKER-CONTRACT] PASS ${dockerfile}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('[DOCKER-CONTRACT] All Docker build inputs are present and ordered correctly.');
