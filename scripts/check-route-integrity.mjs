import { readFileSync, existsSync } from 'node:fs';

// Route-integrity gate: every internal href in the site content manifest must
// resolve to a real route file. A gate that silently passes when it has nothing
// to check is a false-green — so a missing manifest is a HARD FAILURE, not a skip.
const candidateManifests = [
  'armageddon-site/src/content/site.ts',
  'armageddon-site/src/content/site.tsx',
  'armageddon-site/src/content/nav.ts',
  'armageddon-site/src/config/site.ts',
];
const allowlistPath = 'scripts/route-allowlist.json';

const contentPath = candidateManifests.find((p) => existsSync(p));

if (!contentPath) {
  console.error('[ROUTE-INTEGRITY] FAIL: no content manifest found. Checked:');
  for (const p of candidateManifests) console.error(`  - ${p}`);
  console.error('A route-integrity gate with no manifest checks nothing and must not report green.');
  console.error('Fix: restore the manifest, add its path to candidateManifests, or replace this gate with real route scanning.');
  process.exit(1);
}

const ts = readFileSync(contentPath, 'utf8');
const allowlist = existsSync(allowlistPath)
  ? JSON.parse(readFileSync(allowlistPath, 'utf8')).allowlist ?? []
  : [];
const map = new Map(allowlist.map((entry) => [entry.route, entry.reason]));

const hrefRegex = /href\s*:\s*["'`]([^"'`]+)["'`]/g;
let match;
let failed = false;

while ((match = hrefRegex.exec(ts)) !== null) {
  const href = match[1];

  if (!href.startsWith('/')) {
    continue;
  }

  const clean = href.replace(/^\//, '').replace(/\/$/, '');
  const candidates = [
    `armageddon-site/src/app/${clean}/page.tsx`,
    `armageddon-site/src/app/${clean}/page.ts`,
    `armageddon-site/src/pages/${clean}.tsx`,
    `armageddon-site/src/pages/${clean}.ts`
  ];

  if (map.has(href)) {
    console.log(`[ALLOWLISTED] ${href} — ${map.get(href)}`);
    continue;
  }

  if (!candidates.some((file) => existsSync(file))) {
    console.error(`[GHOST ROUTE] ${href} → no matching route file`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[ROUTE-INTEGRITY] OK — manifest ${contentPath} validated.`);
