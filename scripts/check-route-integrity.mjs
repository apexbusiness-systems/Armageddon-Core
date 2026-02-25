import { readFileSync, existsSync } from 'node:fs';

const contentPath = 'armageddon-site/src/content/site.ts';
const allowlistPath = 'scripts/route-allowlist.json';

if (!existsSync(contentPath)) {
  console.log(`[ROUTE-INTEGRITY] FILE_MISSING: ${contentPath} (no content manifest in this repo)`);
  process.exit(0);
}

const ts = readFileSync(contentPath, 'utf8');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')).allowlist ?? [];
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
