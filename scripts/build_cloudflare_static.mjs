#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARMAGEDDON — Cloudflare static-edge build
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Cloudflare deployment serves the Next.js app as a static export
 * (`output: export`) through Workers Assets. The dynamic `src/app/api/*`
 * route handlers (Supabase / Temporal / Node runtime) cannot be represented
 * in a static export and are NOT served by the static edge — they belong to
 * the worker / Temporal backend.
 *
 * Next.js fails the export build when it tries to collect page data for those
 * dynamic routes. To keep the export green without deleting backend code, we
 * relocate the `api` segment out of the app tree for the duration of the
 * export build and always restore it afterwards (success or failure).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    applyPublicBuildEnv,
    assertExportedStripeLinks,
    assertRevenueLinks,
    countDistinctStripeLinks,
    readPublicVars,
    resolveExportedPricingHtml,
    shouldEnforceRevenueGate,
} from './lib/public-build-env.mjs';

const require = createRequire(import.meta.url);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const siteDir = path.join(repoRoot, 'armageddon-site');
const apiDir = path.join(siteDir, 'src', 'app', 'api');
// Stash outside `src/` so Next's App Router never scans it as routes.
const stashDir = path.join(siteDir, '.api-static-export-stash');

// Resolve absolute paths to the node binary and the Next.js CLI so we never
// rely on PATH lookup to locate the executable (avoids PATH-injection risk).
const nextCli = require.resolve('next/dist/bin/next');

async function moveIfExists(from, to) {
    if (existsSync(from)) {
        await rename(from, to);
        return true;
    }
    return false;
}

// Public build config: wrangler.jsonc `vars` is the single source of truth for
// NEXT_PUBLIC_* values, which Next inlines at BUILD time (the Worker only sees
// them at runtime). Explicit env values keep priority.
const buildEnv = { ...process.env, CLOUDFLARE_STATIC_EXPORT: 'true' };
const filledFromWrangler = applyPublicBuildEnv(
    readPublicVars(readFileSync(path.join(siteDir, 'wrangler.jsonc'), 'utf8')),
    buildEnv,
);
console.log(`[cf-build] Public build config from wrangler.jsonc vars: ${filledFromWrangler.join(', ') || '(none; all already set)'}`);
const enforceRevenueGate = shouldEnforceRevenueGate(buildEnv);

/** Revenue gate, part 2: the exported pricing page must carry every paid Payment Link. */
function checkExportedPricing() {
    const pricingPath = resolveExportedPricingHtml(path.join(siteDir, 'out'));
    const html = pricingPath ? readFileSync(pricingPath, 'utf8') : null;
    if (enforceRevenueGate) {
        const count = assertExportedStripeLinks(html);
        console.log(`[cf-build] Revenue gate passed: ${count} distinct Stripe Payment Links in exported pricing page`);
    } else {
        const count = html === null ? 0 : countDistinctStripeLinks(html);
        console.log(`[cf-build] Exported pricing page carries ${count} distinct Stripe Payment Link(s) (gate enforced on CI only)`);
    }
}

// Top-level await (this is an ES module): the `finally` block always restores
// the api segment before the process exits, and `process.exitCode` is used
// instead of `process.exit()` so the restore is never skipped on failure.
let stashed = false;
try {
    // Revenue gate, part 1: refuse to build a production export whose paid CTAs
    // would silently fall back to `payment=pending` (fails before any build work).
    if (enforceRevenueGate) assertRevenueLinks(buildEnv);
    stashed = await moveIfExists(apiDir, stashDir);
    if (stashed) {
        console.log('[cf-build] Excluded src/app/api from static export (dynamic routes run on the worker/Temporal backend)');
    }
    execFileSync(process.execPath, [nextCli, 'build'], {
        cwd: siteDir,
        stdio: 'inherit',
        env: buildEnv,
    });
    checkExportedPricing();
} catch (err) {
    console.error('[cf-build] Static export build failed');
    console.error(err.message ?? err);
    process.exitCode = 1;
} finally {
    if (stashed && existsSync(stashDir)) {
        await rename(stashDir, apiDir);
        console.log('[cf-build] Restored src/app/api');
    }
}
