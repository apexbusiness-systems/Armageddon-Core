#!/usr/bin/env node
/**
 * check-docker-build-contract.mjs
 *
 * Structural gate: exits nonzero unless every Docker build input is present and
 * ordered correctly.  Run this in CI before the Docker build steps so a missing
 * COPY is caught before Render ever attempts the image.
 *
 * Checks:
 *  1. packages/core/scripts/bundle-workflows.mjs exists on disk.
 *  2. armageddon-core package.json defines bundle:workflows as expected.
 *  3. Both production Dockerfiles COPY the script *before* invoking it.
 *  4. Both Dockerfiles switch to a non-root USER before CMD.
 *  5. Dockerfile.api contains start.sh in its CMD.
 *  6. Both Dockerfiles define a HEALTHCHECK.
 */

import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BUNDLE_SCRIPT_PATH = 'packages/core/scripts/bundle-workflows.mjs';
const CORE_PACKAGE_PATH  = 'packages/core/package.json';

const DOCKERFILES = [
  {
    path:        'packages/core/Dockerfile.api',
    label:       'Dockerfile.api (execution API)',
    requiresStartSh: true,
  },
  {
    path:        'packages/core/Dockerfile',
    label:       'Dockerfile (worker)',
    requiresStartSh: false,
  },
];

/** Patterns that count as "copies the bundle script before invoking it" */
const ACCEPTED_COPY_PATTERNS = [
  /COPY\s+packages\/core\/scripts\/bundle-workflows\.mjs\s+\.\/packages\/core\/scripts\/bundle-workflows\.mjs/,
  /COPY\s+packages\/core\/scripts\s+\.\/packages\/core\/scripts(?:\/|\s|$)/,
];

const NPM_INVOKE_PATTERN  = /npm\s+run\s+bundle:workflows/;
const NON_ROOT_USER_PATTERN = /^USER\s+(?!root\b)\S+/m;
const HEALTHCHECK_PATTERN   = /^HEALTHCHECK\b/m;
const START_SH_PATTERN      = /start\.sh/;

let failed = false;

function fail(message) {
  console.error(`[DOCKER-CONTRACT] FAIL — ${message}`);
  failed = true;
}

function pass(message) {
  console.log(`[DOCKER-CONTRACT] PASS — ${message}`);
}

// ── 1. Bundle script exists on disk ─────────────────────────────────────────

try {
  await access(BUNDLE_SCRIPT_PATH);
  const raw = await readFile(BUNDLE_SCRIPT_PATH, 'utf8');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  pass(`${BUNDLE_SCRIPT_PATH} exists (sha256:${hash}…)`);
} catch {
  fail(
    `Missing source file: ${BUNDLE_SCRIPT_PATH}\n` +
    '  This file must exist before either Dockerfile can build the workflow bundle.\n' +
    '  Did you forget to create it or include it in the repository?'
  );
}

// ── 2. armageddon-core bundle:workflows script is correct ───────────────────

try {
  const pkg = JSON.parse(await readFile(CORE_PACKAGE_PATH, 'utf8'));
  const script = pkg.scripts?.['bundle:workflows'];
  if (script === 'node scripts/bundle-workflows.mjs') {
    pass(`${CORE_PACKAGE_PATH} bundle:workflows = "${script}"`);
  } else {
    fail(
      `${CORE_PACKAGE_PATH} bundle:workflows is "${script ?? '(missing)'}"; ` +
      'expected "node scripts/bundle-workflows.mjs".\n' +
      '  The Dockerfiles invoke this npm script by name. If the command changes,\n' +
      '  update this checker and both Dockerfiles in the same patch.'
    );
  }
} catch (err) {
  fail(`Cannot read ${CORE_PACKAGE_PATH}: ${err.message}`);
}

// ── 3–6. Per-Dockerfile checks ───────────────────────────────────────────────

for (const { path: dockerfilePath, label, requiresStartSh } of DOCKERFILES) {
  let text;
  try {
    text = await readFile(dockerfilePath, 'utf8');
  } catch (err) {
    fail(`Cannot read ${dockerfilePath}: ${err.message}`);
    continue;
  }

  // 3a. Dockerfile invokes the bundle command at all
  const invokeMatch = NPM_INVOKE_PATTERN.exec(text);
  if (!invokeMatch) {
    fail(
      `${label} (${dockerfilePath}) does not invoke "npm run bundle:workflows".\n` +
      '  If the bundling step was intentionally removed, verify the worker can\n' +
      '  load workflow code without a pre-built bundle and update this checker.'
    );
    continue;
  }
  const invokeIndex = invokeMatch.index;

  // 3b. A COPY of the script appears *before* the invoke
  let copyIndex = -1;
  for (const pattern of ACCEPTED_COPY_PATTERNS) {
    const m = pattern.exec(text);
    if (m && m.index < invokeIndex) {
      copyIndex = m.index;
      break;
    }
  }

  if (copyIndex < 0) {
    fail(
      `${label} (${dockerfilePath}) invokes "npm run bundle:workflows" at offset ${invokeIndex} ` +
      `but does NOT copy ${BUNDLE_SCRIPT_PATH} before that point.\n` +
      '  Add one of the following lines before the RUN build layer:\n' +
      `    COPY ${BUNDLE_SCRIPT_PATH} ./${BUNDLE_SCRIPT_PATH}\n` +
      `    COPY packages/core/scripts ./packages/core/scripts`
    );
  } else {
    pass(`${label}: COPY of bundle script (offset ${copyIndex}) precedes npm invoke (offset ${invokeIndex})`);
  }

  // 4. Non-root USER
  if (NON_ROOT_USER_PATTERN.test(text)) {
    pass(`${label}: non-root USER present`);
  } else {
    fail(
      `${label} (${dockerfilePath}) does not switch to a non-root USER before CMD.\n` +
      '  Add: USER <non-root-username>  before the EXPOSE/CMD instructions.'
    );
  }

  // 5. HEALTHCHECK
  if (HEALTHCHECK_PATTERN.test(text)) {
    pass(`${label}: HEALTHCHECK present`);
  } else {
    fail(
      `${label} (${dockerfilePath}) is missing a HEALTHCHECK instruction.\n` +
      '  Health checks allow Render and Docker Compose to detect an unhealthy container.'
    );
  }

  // 6. start.sh in CMD (Dockerfile.api only)
  if (requiresStartSh) {
    if (START_SH_PATTERN.test(text)) {
      pass(`${label}: start.sh referenced in CMD`);
    } else {
      fail(
        `${label} (${dockerfilePath}) does not reference start.sh in its CMD.\n` +
        '  Dockerfile.api must launch both the API server and the Temporal worker\n' +
        '  via the unified start.sh watchdog script.'
      );
    }
  }
}

// ── Final verdict ────────────────────────────────────────────────────────────

if (failed) {
  console.error('\n[DOCKER-CONTRACT] FAILED — one or more contract violations found above.');
  process.exit(1);
} else {
  console.log('\n[DOCKER-CONTRACT] ALL CHECKS PASSED — Docker build inputs are present and ordered correctly.');
}
