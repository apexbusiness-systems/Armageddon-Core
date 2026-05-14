#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.html']);
const EXCLUDED_PREFIXES = [
  'node_modules/',
  '.git/',
  'omni-test-universal-v3/',
  'docs/audits/',
  'docs/launch-prep/',
];
const EXCLUDED_FILES = new Set([
  'docs/DOCUMENTATION_AUDIT_2026-05-14.md',
  'audit_log.md',
]);
const FORBIDDEN_PATTERNS = [
  {
    pattern: /npm run start:worker/g,
    message: 'Use `npm run worker -w armageddon-core`; `start:worker` is not a defined script.',
  },
  {
    pattern: /\bbun\s+(lint|typecheck|run build)\b/g,
    message: 'Root validation is npm-based; do not document Bun validation commands.',
  },
  {
    pattern: /Let me know what you see|RIGHT NOW/g,
    message: 'Docs must be executable and non-conversational.',
  },
];

function isDocFile(path) {
  return DOC_EXTENSIONS.has(path.slice(path.lastIndexOf('.')));
}

function isExcluded(path) {
  return EXCLUDED_FILES.has(path) || EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    const path = relative(ROOT, absolute).replaceAll('\\', '/');
    if (isExcluded(path) || isExcluded(`${path}/`)) return [];
    if (entry.isDirectory()) return walk(absolute);
    if (entry.isFile() && isDocFile(path)) return [path];
    return [];
  });
}

const failures = [];
for (const file of walk(ROOT)) {
  if (!statSync(file).isFile()) continue;
  const text = readFileSync(file, 'utf8');
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      failures.push(`${file}:${line}: ${message}`);
    }
  }
}

if (failures.length > 0) {
  console.error('[DOCS-DRIFT] Forbidden documentation drift detected:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[DOCS-DRIFT] Documentation command drift check passed.');
