import { readFileSync, existsSync } from "node:fs";

const contentPath = "apps/omnihub-site/src/content/site.ts";
const allowlistPath = "scripts/route-allowlist.json";

const ts = readFileSync(contentPath, "utf8");
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8")).allowlist ?? [];
const map = new Map(allowlist.map((x) => [x.route, x.reason]));

const hrefRegex = /href\s*:\s*["'`]([^"'`]+)["'`]/g;
let m;
let failed = false;

while ((m = hrefRegex.exec(ts)) !== null) {
  const href = m[1];
  if (!href.startsWith("/")) continue;

  const clean = href.replace(/^\//, "").replace(/\/$/, "");
  const candidates = [
    `apps/omnihub-site/src/app/${clean}/page.tsx`,
    `apps/omnihub-site/src/app/${clean}/page.ts`,
    `apps/omnihub-site/src/pages/${clean}.tsx`,
    `apps/omnihub-site/src/pages/${clean}.ts`
  ];

  if (map.has(href)) {
    console.log(`[ALLOWLISTED] ${href} — ${map.get(href)}`);
    continue;
  }

  if (!candidates.some((f) => existsSync(f))) {
    console.error(`[GHOST ROUTE] ${href} → no matching route file`);
    failed = true;
  }
}

if (failed) process.exit(1);
