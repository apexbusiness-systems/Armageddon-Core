import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Route-integrity gate (real scan).
// Scans every internal href (`href="/..."`, `href: '/...'`, `href={'/...'}`) in
// the site source and verifies each resolves to a real app-router route. Dynamic
// segments ([slug], [...rest]) and route groups ((group)) are honored. A genuine
// ghost route fails the build; template-literal/external/anchor hrefs are skipped.
// There is no separate manifest to drift — the source of truth is the code.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = 'armageddon-site';
const APP_DIR = path.join(SITE, 'src', 'app');
const PAGES_DIR = path.join(SITE, 'src', 'pages');
const SCAN_DIRS = [path.join(SITE, 'src', 'app'), path.join(SITE, 'src', 'components')];
const allowlistPath = 'scripts/route-allowlist.json';

if (!existsSync(APP_DIR)) {
  console.error(`[ROUTE-INTEGRITY] FAIL: app router directory not found: ${APP_DIR}`);
  process.exit(1);
}

const allowlist = existsSync(allowlistPath)
  ? (JSON.parse(readFileSync(allowlistPath, 'utf8')).allowlist ?? [])
  : [];
const allowMap = new Map(allowlist.map((e) => [e.route, e.reason]));

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// ─── Build the set of real route patterns from the app router (+ pages dir) ──
// A pattern is an array of segment matchers: { type: 'literal'|'param'|'rest', value }.
function toMatcher(segment) {
  if (segment.startsWith('[...') && segment.endsWith(']')) return { type: 'rest' };
  if (segment.startsWith('[') && segment.endsWith(']')) return { type: 'param' };
  return { type: 'literal', value: segment };
}

function routePatternFromFile(file, rootDir, kind) {
  const rel = path.relative(rootDir, file);
  let segs = rel.split(path.sep);
  segs.pop(); // drop filename (page.tsx / route.ts)
  // Drop route groups (group) and parallel/intercepting markers (@slot).
  segs = segs.filter((s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@'));
  const pattern = segs.map(toMatcher);
  return { pattern, kind };
}

const routePatterns = [];
for (const file of walk(APP_DIR)) {
  const base = path.basename(file);
  const ext = path.extname(file);
  if (!CODE_EXT.has(ext)) continue;
  if (/^page\./.test(base)) routePatterns.push(routePatternFromFile(file, APP_DIR, 'page'));
  else if (/^route\./.test(base)) routePatterns.push(routePatternFromFile(file, APP_DIR, 'route'));
}
// Legacy pages/ router (file = route).
for (const file of walk(PAGES_DIR)) {
  const ext = path.extname(file);
  if (!CODE_EXT.has(ext)) continue;
  const rel = path.relative(PAGES_DIR, file).replace(new RegExp(`\\${ext}$`), '');
  if (rel.startsWith('_') || rel.startsWith('api' + path.sep)) continue;
  const segs = rel.split(path.sep).filter((s) => s !== 'index').map(toMatcher);
  routePatterns.push({ pattern: segs, kind: 'page' });
}

function segmentsOf(urlPath) {
  return urlPath.split('/').filter(Boolean);
}

function matchesPattern(segments, pattern) {
  let i = 0;
  for (let p = 0; p < pattern.length; p++) {
    const m = pattern[p];
    if (m.type === 'rest') return true; // catch-all consumes the remainder
    if (i >= segments.length) return false;
    if (m.type === 'literal' && m.value !== segments[i]) return false;
    i++;
  }
  return i === segments.length;
}

function routeExists(urlPath) {
  const segments = segmentsOf(urlPath);
  if (segments.length === 0) {
    // "/" → an app/page.* or pages/index.* with an empty pattern.
    return routePatterns.some((r) => r.pattern.length === 0);
  }
  return routePatterns.some((r) => matchesPattern(segments, r.pattern));
}

// ─── Extract internal hrefs from source and validate them ────────────────────
const hrefRegex = /href\s*[:=]\s*\{?\s*["'`]([^"'`]+)["'`]/g;
const ghosts = [];
let checked = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    if (!CODE_EXT.has(path.extname(file))) continue;
    const src = readFileSync(file, 'utf8');
    let match;
    while ((match = hrefRegex.exec(src)) !== null) {
      const raw = match[1];
      if (!raw.startsWith('/')) continue;            // external / anchor / mailto / tel
      if (raw.includes('${')) continue;              // unresolvable template literal
      const clean = raw.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
      if (allowMap.has(raw) || allowMap.has(clean)) continue;
      // Static assets served from public/ are valid targets (images, manifest, etc.).
      if (clean !== '/' && existsSync(path.join(SITE, 'public', clean))) continue;
      checked++;
      if (!routeExists(clean)) {
        ghosts.push({ href: raw, file: path.relative(process.cwd(), file) });
      }
    }
  }
}

if (ghosts.length > 0) {
  console.error('[ROUTE-INTEGRITY] FAIL — internal href(s) with no matching route:');
  for (const g of ghosts) console.error(`  [GHOST ROUTE] ${g.href}  (${g.file})`);
  console.error('Fix the link, add the route, or add an entry to scripts/route-allowlist.json.');
  process.exit(1);
}

console.log(`[ROUTE-INTEGRITY] OK — ${checked} internal href(s) validated against ${routePatterns.length} routes.`);
