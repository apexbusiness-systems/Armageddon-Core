#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(repoRoot, 'armageddon-site', 'wrangler.jsonc');
const raw = readFileSync(configPath, 'utf8');

const withoutLineComments = raw
  .split('\n')
  .map((line) => line.replace(/(^|\s+)\/\/.*$/, '$1'))
  .join('\n');
const config = JSON.parse(withoutLineComments);

let failures = 0;
function pass(message) {
  console.log(`PASS: ${message}`);
}
function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

if (config.main === 'src/intake-handler.ts') {
  pass('Worker script configured: src/intake-handler.ts');
} else {
  fail(`Worker script must be src/intake-handler.ts, got ${JSON.stringify(config.main)}`);
}

if (config.assets?.directory === './out') {
  pass('Static assets directory configured: ./out');
} else {
  fail(`Static assets directory must be ./out, got ${JSON.stringify(config.assets?.directory)}`);
}

if (!Object.prototype.hasOwnProperty.call(config.assets ?? {}, 'binding')) {
  pass('assets.binding absent');
} else {
  fail('assets.binding must be absent when a Worker script is configured');
}

if (config.main && config.assets?.directory && !Object.prototype.hasOwnProperty.call(config.assets ?? {}, 'binding')) {
  pass('no assets-only/binding conflict');
} else {
  fail('Worker config still risks an assets-only/binding conflict');
}

process.exitCode = failures === 0 ? 0 : 1;
