#!/usr/bin/env node
/**
 * Pre-deployment environment validation for Armageddon Test Suite.
 *
 * Guards verified in order:
 *   1. NEXT_PUBLIC_SITE_URL — must equal https://armageddontest.icu
 *   2. NEXT_PUBLIC_SUPABASE_URL — must be present, must NOT be localhost/127.0.0.1
 *   3. NEXT_PUBLIC_SUPABASE_ANON_KEY — must be present and non-empty
 *   4. NEXT_PUBLIC_ARMAGEDDON_API_BASE — if set, must be https and not localhost
 *
 * ROOT CAUSE GUARDRAIL (Issue #141):
 *   Verification emails redirect to the Supabase project Site URL. If that URL is
 *   localhost:3000 (default when a project is bootstrapped locally), every email
 *   link breaks in production. This script detects the mismatch at build time so
 *   it never reaches the deployed artifact.
 *
 *   The Supabase Site URL must be manually set in the Supabase dashboard:
 *     Authentication → URL Configuration → Site URL → https://armageddontest.icu
 *     Redirect URLs → add: https://armageddontest.icu/**
 *
 * Run: node scripts/validate-armageddon-production-env.mjs
 * Exit 0 = all checks passed. Exit 1 = one or more checks failed.
 */

const CANONICAL_PRODUCTION_URL = 'https://armageddontest.icu';

const BANNED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'omnihub',
    'apex-omnihub',
    'armageddon.apex.com',
    'www.armageddon.icu',
];

let failed = false;

function fail(message) {
    console.error(`❌ VALIDATION FAILED: ${message}`);
    failed = true;
}

function pass(message) {
    console.log(`✅ ${message}`);
}

function isBannedHost(hostname) {
    const lower = hostname.toLowerCase();
    return BANNED_HOSTS.some(p => lower.includes(p));
}

function parseUrl(raw, varName) {
    try {
        return new URL(raw);
    } catch {
        fail(`${varName} is not a valid URL: "${raw}"`);
        return null;
    }
}

// ── Guard 1: NEXT_PUBLIC_SITE_URL ─────────────────────────────────────────────
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) {
    fail('NEXT_PUBLIC_SITE_URL is missing.');
} else {
    const parsed = parseUrl(siteUrl, 'NEXT_PUBLIC_SITE_URL');
    if (parsed) {
        if (isBannedHost(parsed.hostname)) {
            fail(`NEXT_PUBLIC_SITE_URL contains banned hostname "${parsed.hostname}". Must be armageddontest.icu.`);
        } else if (siteUrl !== CANONICAL_PRODUCTION_URL) {
            fail(`NEXT_PUBLIC_SITE_URL "${siteUrl}" does not match canonical URL ${CANONICAL_PRODUCTION_URL}.`);
        } else {
            pass(`NEXT_PUBLIC_SITE_URL = ${siteUrl}`);
        }
    }
}

// ── Guard 2: NEXT_PUBLIC_SUPABASE_URL ─────────────────────────────────────────
// CRITICAL: if this is localhost, Supabase verification emails will link to localhost.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
    fail('NEXT_PUBLIC_SUPABASE_URL is missing. Auth and DB are non-functional without it.');
} else {
    const parsed = parseUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL');
    if (parsed) {
        if (isBannedHost(parsed.hostname)) {
            fail(
                `NEXT_PUBLIC_SUPABASE_URL hostname "${parsed.hostname}" is localhost or banned. ` +
                'This causes verification emails to redirect to localhost in production. ' +
                'Set this to your Supabase project URL (https://<ref>.supabase.co) and ' +
                'update the Supabase dashboard Site URL to https://armageddontest.icu.'
            );
        } else if (!parsed.hostname.endsWith('.supabase.co') && !parsed.hostname.endsWith('.supabase.in')) {
            fail(
                `NEXT_PUBLIC_SUPABASE_URL hostname "${parsed.hostname}" does not look like a Supabase project URL. ` +
                'Expected *.supabase.co or *.supabase.in.'
            );
        } else {
            pass(`NEXT_PUBLIC_SUPABASE_URL = ${supabaseUrl}`);
        }
    }
}

// ── Guard 3: NEXT_PUBLIC_SUPABASE_ANON_KEY ────────────────────────────────────
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!anonKey || anonKey.trim() === '') {
    fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty. Client-side auth will not work.');
} else if (!anonKey.startsWith('eyJ')) {
    fail(`NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a valid JWT (expected "eyJ..." prefix).`);
} else {
    pass(`NEXT_PUBLIC_SUPABASE_ANON_KEY is set (${anonKey.length} chars).`);
}

// ── Guard 4: NEXT_PUBLIC_ARMAGEDDON_API_BASE (optional, but validated if present) ─
const apiBase = process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE;
if (apiBase && apiBase.trim() !== '') {
    const parsed = parseUrl(apiBase, 'NEXT_PUBLIC_ARMAGEDDON_API_BASE');
    if (parsed) {
        if (isBannedHost(parsed.hostname)) {
            fail(
                `NEXT_PUBLIC_ARMAGEDDON_API_BASE hostname "${parsed.hostname}" is localhost. ` +
                'The dynamic API backend must be reachable from browsers — localhost is not valid for production.'
            );
        } else if (parsed.protocol !== 'https:') {
            fail(`NEXT_PUBLIC_ARMAGEDDON_API_BASE must use https:// in production. Got: "${parsed.protocol}".`);
        } else {
            pass(`NEXT_PUBLIC_ARMAGEDDON_API_BASE = ${apiBase}`);
        }
    }
} else {
    console.warn('⚠️  NEXT_PUBLIC_ARMAGEDDON_API_BASE is not set — dynamic console will degrade honestly (no live runs).');
}

// ── Result ────────────────────────────────────────────────────────────────────
if (failed) {
    console.error('\n❌ ARMAGEDDON ENV VALIDATION FAILED — resolve all errors above before deploying.');
    process.exit(1);
} else {
    console.log('\n✅ ARMAGEDDON ENV VALIDATION PASSED — environment is production-ready.');
}
