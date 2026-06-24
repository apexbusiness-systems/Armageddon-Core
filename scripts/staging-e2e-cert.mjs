#!/usr/bin/env node
/**
 * Armageddon Staging E2E Certification Script
 *
 * Verifies the complete production path against a live Supabase + dynamic API:
 *
 *   1. Env vars are present and valid
 *   2. Supabase auth — exchange email+password for a session token
 *   3. /api/me/organizations — org resolves to real organization_id
 *   4. /api/run — run row created with status=pending
 *   5. Run polling — status transitions pending → running → passed|failed
 *   6. /api/omniport/health — Temporal + Supabase both reachable
 *   7. Evidence export / terminal status persistence
 *
 * Usage:
 *   STAGING_EMAIL=user@example.com \
 *   STAGING_PASSWORD=supersecret \
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
 *   NEXT_PUBLIC_ARMAGEDDON_API_BASE=https://api.armageddontest.icu \
 *     node scripts/staging-e2e-cert.mjs
 *
 * Exit 0 = all checks passed. Exit 1 = one or more checks failed.
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_BASE = process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE;
const STAGING_EMAIL = process.env.STAGING_EMAIL;
const STAGING_PASSWORD = process.env.STAGING_PASSWORD;
const RUN_TIMEOUT_MS = parseInt(process.env.RUN_TIMEOUT_MS ?? '120000', 10); // 2 min default
const POLL_INTERVAL_MS = 3000;

let passed = 0;
let failed = 0;

function ok(label) {
    console.log(`  ✅ ${label}`);
    passed++;
}

function fail(label, detail = '') {
    console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
}

function section(title) {
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Step 0: Env Preflight ─────────────────────────────────────────────────────
section('Step 0: Env Preflight');

const required = { SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE, STAGING_EMAIL, STAGING_PASSWORD };
let envOk = true;
for (const [k, v] of Object.entries(required)) {
    if (!v) { fail(`${k} is missing`); envOk = false; } else { ok(`${k} is set`); }
}

if (!envOk) {
    console.error('\nAbort: missing required env vars. See script header for usage.');
    process.exit(1);
}

// Reject localhost API base — this script targets staging/production only.
try {
    const parsed = new URL(API_BASE);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        fail('NEXT_PUBLIC_ARMAGEDDON_API_BASE is localhost — this script tests remote staging only');
        process.exit(1);
    }
    ok(`API_BASE hostname: ${parsed.hostname}`);
} catch {
    fail('NEXT_PUBLIC_ARMAGEDDON_API_BASE is not a valid URL');
    process.exit(1);
}

// ── Step 1: Supabase Auth ─────────────────────────────────────────────────────
section('Step 1: Supabase Auth (email+password)');

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let accessToken = null;

try {
    const { data, error } = await sb.auth.signInWithPassword({
        email: STAGING_EMAIL,
        password: STAGING_PASSWORD,
    });
    if (error) {
        fail('signInWithPassword', error.message);
        console.error('\nAbort: cannot proceed without a valid session.');
        process.exit(1);
    }
    accessToken = data.session?.access_token;
    if (!accessToken) {
        fail('session.access_token is missing from successful sign-in');
        process.exit(1);
    }
    ok(`Signed in as ${data.user?.email ?? STAGING_EMAIL}`);
    ok(`access_token present (${accessToken.length} chars)`);
} catch (err) {
    fail('Unexpected error during sign-in', err.message);
    process.exit(1);
}

const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
};

// ── Step 2: Org Resolution ────────────────────────────────────────────────────
section('Step 2: GET /api/me/organizations');

let organizationId = null;

try {
    const res = await fetch(`${API_BASE}/api/me/organizations`, { headers: authHeaders });
    if (!res.ok) {
        fail(`/api/me/organizations returned HTTP ${res.status}`);
    } else {
        const data = await res.json();
        organizationId = data?.active?.organization_id;
        if (!organizationId) {
            fail('No active.organization_id in response', JSON.stringify(data));
        } else {
            ok(`organization_id = ${organizationId}`);
        }
    }
} catch (err) {
    fail('/api/me/organizations fetch error', err.message);
}

if (!organizationId) {
    console.error('\nAbort: cannot start a run without an organization.');
    process.exit(1);
}

// ── Step 3: OmniPort Health ───────────────────────────────────────────────────
section('Step 3: GET /api/omniport/health');

try {
    const res = await fetch(`${API_BASE}/api/omniport/health`, { headers: authHeaders });
    const data = await res.json();
    const { status, temporalConnected, supabaseConnected } = data;

    if (status === 'operational') {
        ok(`Health: operational (Temporal=${temporalConnected}, Supabase=${supabaseConnected})`);
    } else if (status === 'degraded') {
        console.warn(`  ⚠️  Health: degraded (Temporal=${temporalConnected}, Supabase=${supabaseConnected})`);
    } else {
        fail(`Health: ${status} — both dependencies are unreachable`);
    }
} catch (err) {
    fail('/api/omniport/health fetch error', err.message);
}

// ── Step 4: Start a Run ───────────────────────────────────────────────────────
section('Step 4: POST /api/run');

let runId = null;

try {
    const res = await fetch(`${API_BASE}/api/run`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ organizationId, level: 1, batteries: ['B10'] }),
    });
    const data = await res.json();
    if (!res.ok) {
        fail(`/api/run returned HTTP ${res.status}`, data?.error ?? JSON.stringify(data));
    } else {
        runId = data?.runId;
        if (!runId) {
            fail('Response missing runId', JSON.stringify(data));
        } else {
            ok(`run created: runId=${runId}`);
        }
    }
} catch (err) {
    fail('/api/run fetch error', err.message);
}

if (!runId) {
    console.error('\nAbort: no runId returned — cannot poll for status.');
    process.exit(1);
}

// ── Step 5: Poll Run Status ───────────────────────────────────────────────────
section(`Step 5: Poll armageddon_runs (timeout=${RUN_TIMEOUT_MS / 1000}s)`);

const TERMINAL = new Set(['passed', 'failed', 'cancelled']);
const deadline = Date.now() + RUN_TIMEOUT_MS;
let finalStatus = null;
let finalRun = null;

while (Date.now() < deadline) {
    const { data: row, error } = await sb
        .from('armageddon_runs')
        .select('status, escape_rate, batteries_executed, batteries_passed, batteries_failed, completed_at')
        .eq('id', runId)
        .single();

    if (error) {
        fail('armageddon_runs query error', error.message);
        break;
    }

    process.stdout.write(`\r  ⏳ status=${row.status}                    `);

    if (TERMINAL.has(row.status)) {
        finalStatus = row.status;
        finalRun = row;
        break;
    }

    await sleep(POLL_INTERVAL_MS);
}

process.stdout.write('\n');

if (!finalStatus) {
    fail(`Run did not reach terminal status within ${RUN_TIMEOUT_MS / 1000}s`);
} else if (finalStatus === 'cancelled') {
    fail(`Run was cancelled — expected passed or failed`);
} else {
    ok(`Run reached terminal status: ${finalStatus}`);
    if (finalRun?.completed_at) ok(`completed_at is set: ${finalRun.completed_at}`);
    else fail('completed_at is null on terminal run');
    if (typeof finalRun?.escape_rate === 'number') ok(`escape_rate = ${finalRun.escape_rate}`);
    else fail('escape_rate is null on terminal run');
}

// ── Step 6: Reporter Events Persisted ────────────────────────────────────────
section('Step 6: armageddon_events snake_case shape');

const { data: events, error: eventsError } = await sb
    .from('armageddon_events')
    .select('run_id, battery_id, event_type, severity, message, iteration, payload, created_at')
    .eq('run_id', runId)
    .limit(5);

if (eventsError) {
    fail('armageddon_events query error', eventsError.message);
} else if (!events || events.length === 0) {
    fail('No events persisted for run — reporter.pushEvent() may not be firing');
} else {
    ok(`${events.length} event(s) found with correct snake_case columns`);
    const first = events[0];
    const requiredCols = ['run_id', 'event_type', 'severity', 'created_at'];
    for (const col of requiredCols) {
        if (first[col] !== undefined && first[col] !== null) ok(`events.${col} present`);
        else fail(`events.${col} is null/missing`);
    }
}

// ── Result ────────────────────────────────────────────────────────────────────
section('Certification Result');
console.log(`  Passed: ${passed}   Failed: ${failed}`);

if (failed > 0) {
    console.error('\n❌ STAGING E2E CERTIFICATION FAILED — resolve all failures before promoting to production.');
    process.exit(1);
} else {
    console.log('\n✅ STAGING E2E CERTIFICATION PASSED — production path verified end-to-end.');
}
