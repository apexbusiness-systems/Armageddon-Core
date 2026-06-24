#!/usr/bin/env node
/**
 * Armageddon Certification API — Standalone Node.js HTTP Server
 *
 * Exposes the dynamic certification API routes that require Temporal gRPC
 * and cannot run in the Cloudflare Edge/Worker runtime:
 *
 *   GET  /health                     — server liveness (for Docker HEALTHCHECK)
 *   GET  /ready                      — readiness (Temporal + Supabase both up)
 *   GET  /api/omniport/health        — full connectivity probe
 *   GET  /api/me/organizations       — auth + org resolution
 *   POST /api/run                    — auth + run creation + Temporal workflow start
 *   GET  /api/run?runId=<id>         — auth + run status fetch
 *   POST /api/gatekeeper             — auth + admin tier check
 *   GET  /api/attestation/pubkey     — Ed25519 public key (503 if seed not set)
 *
 * Env vars (canonical names; legacy aliases accepted):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY                  — service role key (preferred)
 *   SUPABASE_SERVICE_ROLE_SECRET               — accepted alias (deprecated)
 *   TEMPORAL_ADDRESS                           — default: localhost:7233
 *   TEMPORAL_NAMESPACE                         — default: default
 *   TEMPORAL_TASK_QUEUE                        — default: armageddon-level-7
 *   API_PORT                                   — default: 8081
 *   RATE_LIMIT_FAIL_OPEN                       — set true to bypass rate-limit on failure
 *   ADMIN_EMAIL                                — grants admin override in gatekeeper
 *   ARMAGEDDON_ATTESTATION_SEED               — Ed25519 seed (hex/base64)
 *   SIM_MODE                                   — set true for simulation mode
 *   SANDBOX_TENANT                             — tenant identifier
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { getAttestationPublicKey } from './core/attestation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Connection } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import { checkRunEligibility, normalizeIterations, DEFAULT_BATTERIES } from '@armageddon/shared';

// ── Env ────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.API_PORT ?? '8081');

// Canonical: SUPABASE_SERVICE_ROLE_KEY; alias: SUPABASE_SERVICE_ROLE_SECRET
const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^"+|"+$/g, '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_SECRET ??
    ''
).replace(/^"+|"+$/g, '');

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? 'default';
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? 'armageddon-level-7';

// ── Supabase singletons ────────────────────────────────────────────────────────

let _serviceRole: SupabaseClient | null = null;
function getServiceRole(): SupabaseClient {
    if (_serviceRole) return _serviceRole;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _serviceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });
    return _serviceRole;
}

// ── Temporal singleton ─────────────────────────────────────────────────────────

let _temporalClient: Client | null = null;
let _temporalPromise: Promise<Client> | null = null;

async function getTemporalClient(): Promise<Client> {
    if (_temporalClient) return _temporalClient;
    if (_temporalPromise) return _temporalPromise;
    _temporalPromise = (async () => {
        const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
        const client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
        _temporalClient = client;
        console.log(`[Temporal] Connected to ${TEMPORAL_ADDRESS} (ns: ${TEMPORAL_NAMESPACE})`);
        return client;
    })().finally(() => { _temporalPromise = null; });
    return _temporalPromise;
}


// ── HTTP helpers ───────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function extractBearer(req: IncomingMessage): string | null {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) return null;
    return auth.slice(7).trim() || null;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

interface AuthUser { id: string; email?: string }
interface AuthResult { user: AuthUser; supabase: SupabaseClient }
type AuthErr = { status: 401 | 403; error: string }

async function authenticate(req: IncomingMessage): Promise<AuthResult | AuthErr> {
    const token = extractBearer(req);
    if (!token) return { status: 401, error: 'Unauthorized: Missing token' };
    const sb = getServiceRole();
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) {
        console.warn('[Security] Invalid token:', error?.message);
        return { status: 401, error: 'Unauthorized: Invalid token' };
    }
    return { user: { id: user.id, email: user.email }, supabase: sb };
}

function isAuthErr(r: AuthResult | AuthErr): r is AuthErr {
    return 'status' in r;
}

async function verifyMembership(sb: SupabaseClient, userId: string, orgId: string): Promise<boolean> {
    const { data, error } = await sb
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .single();
    return !error && !!data;
}

// ── Route handlers ─────────────────────────────────────────────────────────────

// GET /health
function handleLiveness(_req: IncomingMessage, res: ServerResponse): void {
    json(res, 200, { ok: true });
}

// GET /ready
async function handleReadiness(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    let temporalOk = false;
    let supabaseOk = false;
    try { await getTemporalClient(); temporalOk = true; } catch { /* intentionally empty */ }
    try {
        const sb = getServiceRole();
        const { error } = await sb.from('armageddon_runs').select('id').limit(1);
        supabaseOk = !error;
    } catch { /* intentionally empty */ }
    const status = temporalOk && supabaseOk ? 200 : 503;
    json(res, status, { ready: status === 200, temporalOk, supabaseOk });
}

// GET /api/omniport/health
async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    let temporalConnected = false;
    let temporalError: string | undefined;
    let supabaseConnected = false;
    let supabaseError: string | undefined;

    try { await getTemporalClient(); temporalConnected = true; }
    catch (err) { temporalError = (err as Error).message; }

    try {
        const sb = getServiceRole();
        const { error } = await sb.from('armageddon_runs').select('id').limit(1);
        if (error) { supabaseError = error.message; } else { supabaseConnected = true; }
    } catch (err) { supabaseError = (err as Error).message; }

    const healthy = temporalConnected && supabaseConnected;
    const degraded = temporalConnected !== supabaseConnected;
    const status = healthy ? 200 : degraded ? 207 : 503;
    const statusLabel = healthy ? 'operational' : degraded ? 'degraded' : 'unavailable';

    json(res, status, {
        status: statusLabel,
        version: '1.0.0',
        simMode: process.env.SIM_MODE === 'true',
        temporalConnected,
        ...(temporalError ? { temporalError } : {}),
        supabaseConnected,
        ...(supabaseError ? { supabaseError } : {}),
        omniPortEnabled: true,
        timestamp: Date.now(),
    });
}

// GET /api/me/organizations
async function handleOrganizations(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = await authenticate(req);
    if (isAuthErr(auth)) { json(res, auth.status, { success: false, error: auth.error }); return; }
    const { user, supabase } = auth;

    const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);

    if (error) {
        console.error('[me/organizations] query failed:', error.message);
        json(res, 500, { success: false, error: error.message });
        return;
    }

    const memberships = data ?? [];
    if (memberships.length === 0) {
        json(res, 404, { success: false, error: 'No organization membership', organizations: [] });
        return;
    }

    const active = memberships.find((m: { role: string }) => m.role === 'owner' || m.role === 'admin') ?? memberships[0];
    json(res, 200, { success: true, organizations: memberships, active });
}

// POST /api/run
async function handleRunPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: { organizationId?: string; level?: number; iterations?: number; batteries?: string[] };
    try {
        const raw = await readBody(req);
        body = JSON.parse(raw);
    } catch {
        json(res, 400, { success: false, error: 'Invalid JSON body' });
        return;
    }

    const { organizationId, level = 7, batteries } = body;
    if (!organizationId) {
        json(res, 400, { success: false, error: 'organizationId is required' });
        return;
    }

    const auth = await authenticate(req);
    if (isAuthErr(auth)) { json(res, auth.status, { success: false, error: auth.error }); return; }
    const { user, supabase } = auth;

    // Org membership check
    const isMember = await verifyMembership(supabase, user.id, organizationId);
    if (!isMember) {
        console.warn(`[Security] User ${user.id} not a member of org ${organizationId}`);
        json(res, 403, { success: false, error: 'Forbidden: You are not a member of this organization' });
        return;
    }

    // Validate batteries
    const validPattern = /^B1[0-4]$/;
    let validatedBatteries = DEFAULT_BATTERIES;
    if (batteries && batteries.length > 0) {
        const unique = Array.from(new Set(batteries));
        const invalid = unique.filter((b: string) => !validPattern.test(b));
        if (invalid.length > 0) {
            json(res, 400, { success: false, error: `Invalid battery IDs: ${invalid.join(', ')}` });
            return;
        }
        validatedBatteries = unique;
    }

    // Eligibility check
    const eligibility = await checkRunEligibility(organizationId, level, validatedBatteries, supabase);
    if (!eligibility.eligible) {
        json(res, 403, {
            success: false,
            error: eligibility.reason ?? 'ACCESS_DENIED',
            upsellMessage: eligibility.upsellMessage,
            upgradeUrl: eligibility.upgradeUrl ?? '/pricing?upgrade=certified',
        });
        return;
    }

    // Determine iterations
    const defaultIterations = eligibility.tier === 'certified' && level === 7 ? 10000 : 2500;
    const iterations = normalizeIterations(body.iterations ?? defaultIterations);

    // Create run record
    const runId = uuidv4();
    const workflowId = `armageddon-${runId}`;
    // In SIM_MODE always use FREE tier so SimulationAdapter runs (no live LLM calls).
    const workflowTier = (eligibility.tier === 'certified' && process.env.SIM_MODE !== 'true') ? 'CERTIFIED' : 'FREE';
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    const workflowSeed = Number.parseInt(digest.slice(0, 8), 16);

    const { error: insertError } = await supabase
        .from('armageddon_runs')
        .insert({
            id: runId,
            organization_id: organizationId,
            level,
            sim_mode: true,
            sandbox_tenant: process.env.SANDBOX_TENANT ?? 'armageddon-test',
            workflow_id: workflowId,
            status: 'pending',
            config: {
                batteries: validatedBatteries,
                iterations,
                tier: workflowTier,
                seed: workflowSeed,
            },
        });

    if (insertError) {
        console.error('[run] insert failed:', insertError.message);
        json(res, 500, { success: false, error: 'Failed to create run record' });
        return;
    }

    // Start Temporal workflow
    let client: Client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        // Mark run as failed and propagate the error
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        console.error('[run] Temporal unavailable:', (err as Error).message);
        json(res, 503, { success: false, error: 'Temporal is unavailable — run aborted', runId });
        return;
    }

    try {
        const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            workflowId,
            taskQueue: TEMPORAL_TASK_QUEUE,
            args: [{ runId, organizationId, iterations, tier: workflowTier, seed: workflowSeed, batteries: validatedBatteries }],
        });

        await supabase
            .from('armageddon_runs')
            .update({ workflow_run_id: handle.firstExecutionRunId, status: 'running', started_at: new Date().toISOString() })
            .eq('id', runId);

        json(res, 200, { success: true, runId, workflowId });
    } catch (err) {
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        console.error('[run] workflow.start failed:', (err as Error).message);
        json(res, 500, { success: false, error: 'Failed to start workflow', runId });
    }
}

// GET /api/run?runId=<id>
async function handleRunGet(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): Promise<void> {
    const runId = query.get('runId');
    if (!runId) { json(res, 400, { success: false, error: 'runId is required' }); return; }

    const auth = await authenticate(req);
    if (isAuthErr(auth)) { json(res, auth.status, { success: false, error: auth.error }); return; }
    const { user, supabase } = auth;

    const { data: run, error } = await supabase
        .from('armageddon_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (error || !run) { json(res, 404, { success: false, error: 'Run not found' }); return; }

    const isMember = await verifyMembership(supabase, user.id, run.organization_id);
    if (!isMember) { json(res, 403, { success: false, error: 'Forbidden' }); return; }

    json(res, 200, { success: true, run });
}

// POST /api/gatekeeper
async function handleGatekeeper(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = await authenticate(req);
    if (!isAuthErr(auth)) {
        const { user } = auth;
        if (user.email && process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
            json(res, 200, { eligible: true, tier: 'verified', reason: 'ADMIN_OVERRIDE' });
            return;
        }
    }
    json(res, 200, { eligible: false, tier: 'free', reason: 'LEVEL_7_ACCESS_REQUIRED' });
}

// GET /api/attestation/pubkey
function handleAttestationPubkey(_req: IncomingMessage, res: ServerResponse): void {
    const key = getAttestationPublicKey();
    if (key.source !== 'env') {
        json(res, 503, {
            error: 'ATTESTATION_KEY_NOT_CONFIGURED',
            message: 'Set ARMAGEDDON_ATTESTATION_SEED to publish a stable verification key.',
            spec: key.spec,
            algorithm: key.algorithm,
        });
        return;
    }
    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
    });
    res.end(JSON.stringify({
        spec: key.spec,
        algorithm: key.algorithm,
        keyId: key.keyId,
        publicKey: key.publicKey,
        issuedAt: new Date().toISOString(),
    }));
}

// ── Router ─────────────────────────────────────────────────────────────────────

async function router(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        });
        res.end();
        return;
    }

    try {
        if (path === '/health' && method === 'GET') { handleLiveness(req, res); return; }
        if (path === '/ready' && method === 'GET') { await handleReadiness(req, res); return; }
        if (path === '/api/omniport/health' && method === 'GET') { await handleHealth(req, res); return; }
        if (path === '/api/me/organizations' && method === 'GET') { await handleOrganizations(req, res); return; }
        if (path === '/api/run' && method === 'POST') { await handleRunPost(req, res); return; }
        if (path === '/api/run' && method === 'GET') { await handleRunGet(req, res, url.searchParams); return; }
        if (path === '/api/gatekeeper' && method === 'POST') { await handleGatekeeper(req, res); return; }
        if (path === '/api/attestation/pubkey' && method === 'GET') { handleAttestationPubkey(req, res); return; }

        json(res, 404, { error: 'Not found', path });
    } catch (err) {
        console.error(`[${method} ${path}] Unhandled error:`, (err as Error).message);
        json(res, 500, { error: 'Internal server error' });
    }
}

// ── Pending run dispatcher ─────────────────────────────────────────────────────
// Polls Supabase every POLL_MS for runs with status='pending' and dispatches them
// to Temporal via gRPC. This enables the Cloudflare Worker edge to create pending
// runs without needing gRPC (which is unavailable on the CF edge runtime).

const PENDING_POLL_MS = 5000;
const PENDING_CLAIM_WINDOW_MS = 10 * 60 * 1000; // only pick up runs < 10 min old

async function startPendingRunsLoop(): Promise<void> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[PendingLoop] Missing Supabase credentials — dispatcher disabled.');
        return;
    }
    console.log('[PendingLoop] Pending run dispatcher started.');

    while (true) {
        await new Promise<void>(resolve => setTimeout(resolve, PENDING_POLL_MS));

        try {
            const sb = getServiceRole();
            const cutoff = new Date(Date.now() - PENDING_CLAIM_WINDOW_MS).toISOString();

            const { data: pendingRuns, error } = await sb
                .from('armageddon_runs')
                .select('id, organization_id, level, config, workflow_id')
                .eq('status', 'pending')
                .gte('created_at', cutoff)
                .limit(5);

            if (error) {
                console.error('[PendingLoop] Query error:', error.message);
                continue;
            }
            if (!pendingRuns?.length) continue;

            let client: Client;
            try { client = await getTemporalClient(); }
            catch (err) {
                console.warn('[PendingLoop] Temporal not ready:', (err as Error).message);
                continue;
            }

            for (const run of pendingRuns) {
                const cfg = (run.config ?? {}) as { batteries?: string[]; iterations?: number; tier?: string; seed?: number };
                const { batteries = DEFAULT_BATTERIES, iterations = 2500, tier = 'FREE', seed = 0 } = cfg;
                const workflowTier = (tier === 'certified' && process.env.SIM_MODE !== 'true') ? 'CERTIFIED' : 'FREE';

                try {
                    const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
                        workflowId: run.workflow_id,
                        taskQueue: TEMPORAL_TASK_QUEUE,
                        args: [{ runId: run.id, organizationId: run.organization_id, iterations, tier: workflowTier, seed, batteries }],
                    });

                    await sb.from('armageddon_runs')
                        .update({ status: 'running', workflow_run_id: handle.firstExecutionRunId, started_at: new Date().toISOString() })
                        .eq('id', run.id)
                        .eq('status', 'pending');

                    console.log(`[PendingLoop] Dispatched run ${run.id} → workflow ${run.workflow_id}`);
                } catch (err) {
                    const name = (err as Error).name ?? '';
                    if (name === 'WorkflowExecutionAlreadyStartedError') {
                        // Another dispatcher already claimed this run — leave it alone
                        continue;
                    }
                    console.error(`[PendingLoop] Failed to dispatch run ${run.id}:`, (err as Error).message);
                    await sb.from('armageddon_runs').update({ status: 'failed' }).eq('id', run.id).eq('status', 'pending');
                }
            }
        } catch (err) {
            console.error('[PendingLoop] Unexpected error:', (err as Error).message);
        }
    }
}

// ── Startup ────────────────────────────────────────────────────────────────────

console.log('[Armageddon API] Starting...');
console.log(`  SUPABASE_URL:       ${SUPABASE_URL || '(missing)'}`);
console.log(`  SERVICE_ROLE_KEY:   ${SUPABASE_SERVICE_ROLE_KEY ? '<set>' : '(missing)'}`);
console.log(`  TEMPORAL_ADDRESS:   ${TEMPORAL_ADDRESS}`);
console.log(`  TEMPORAL_NAMESPACE: ${TEMPORAL_NAMESPACE}`);
console.log(`  TEMPORAL_TASK_QUEUE:${TEMPORAL_TASK_QUEUE}`);
console.log(`  SIM_MODE:           ${process.env.SIM_MODE ?? 'false'}`);

const server = createServer((req, res) => {
    void router(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Armageddon API] Listening on port ${PORT}`);
    void startPendingRunsLoop();
});

server.on('error', (err) => {
    console.error('[Armageddon API] Server error:', err);
    process.exit(1);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
