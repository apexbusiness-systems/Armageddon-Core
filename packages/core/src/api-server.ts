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
 *   POST /api/omniport/execute       — OmniHub-triggered remote run (SIM_MODE)
 *   POST /api/omniport/live-fire     — OmniHub-authorized live-fire run (waiver-gated)
 *   POST /api/omniport/control       — signal a running workflow (cancel actionable; others buffered)
 *   POST /api/omniport/waiver        — persist a live-fire waiver acceptance
 *   GET  /api/omniport/telemetry     — pull cached telemetry events for a run
 *
 * The /api/omniport/* routes mirror the reference implementation in
 * armageddon-site/src/app/api/omniport/*\/route.ts. That Next.js layer runs in
 * a static-export deployment and is not reachable in production — this is
 * the process that actually serves the OmniPort connector end-to-end,
 * because it (like /api/run above) needs real Temporal gRPC access.
 *
 * Env vars (canonical names; legacy aliases accepted):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   ARMAGEDDON_DB_URL                          — Supabase URL alias for dashboards that reject SUPABASE_*
 *   SUPABASE_SERVICE_ROLE_KEY                  — service role key (preferred)
 *   SUPABASE_SERVICE_ROLE_SECRET               — accepted alias (deprecated)
 *   ARMAGEDDON_DB_SERVICE_ROLE_KEY             — service-role alias for dashboards that reject SUPABASE_*
 *   TEMPORAL_ADDRESS                           — default: localhost:7233
 *   TEMPORAL_NAMESPACE                         — default: default
 *   TEMPORAL_TASK_QUEUE                        — default: armageddon-level-7 (fallback only;
 *                                                 OmniPort routes prefer a per-operator queue,
 *                                                 see OMNIPORT_TASK_QUEUE_PREFIX)
 *   API_PORT                                   — default: 8081
 *   RATE_LIMIT_FAIL_OPEN                       — set true to bypass rate-limit on failure
 *   ADMIN_EMAIL                                — grants admin override in gatekeeper
 *   ARMAGEDDON_ADMIN_EMAIL                     — optional ADMIN_EMAIL alias
 *   ARMAGEDDON_ATTESTATION_SEED               — Ed25519 seed (hex/base64)
 *   SIM_MODE                                   — set true for simulation mode
 *   SANDBOX_TENANT                             — tenant identifier
 *   OMNIPORT_ENABLED                           — master toggle; all /api/omniport/* routes
 *                                                 except /health return 503 unless 'true'
 *   OMNIPORT_API_KEY                           — bearer token OmniHub must present
 *   OMNIPORT_WEBHOOK_SECRET                     — HMAC secret for telemetry signing
 *   OMNIPORT_LIVE_FIRE_SECRET                   — HS256 secret for live-fire waiver JWTs
 *   OMNIPORT_TASK_QUEUE_PREFIX                  — per-operator Temporal task-queue prefix
 *                                                 (default: armageddon-moat); each org's Moat
 *                                                 worker polls `${prefix}-${organizationId}`
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { getAttestationPublicKey } from './core/attestation.js';
import { createServerSupabaseClient } from './core/supabase-client.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Client, Connection } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import { checkRunEligibility, normalizeIterations, DEFAULT_BATTERIES, readAdminEmail, readSupabaseServiceRoleKey, readSupabaseUrl } from '@armageddon/shared';
import {
    validateSSRF,
    isOmniPortEnabled,
    verifyOmniPortBearerToken,
    verifyWaiverToken,
    deriveRunSeed,
    resolveOmniPortTaskQueue,
} from '@armageddon/shared/omniport';

// ── Env ────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.API_PORT ?? '8081');

// Browser CORS origin for the dynamic API. Locked to the public site by default;
// override with CORS_ALLOW_ORIGIN for staging/local. OmniPort routes are
// server-to-server (bearer-auth) and do not rely on CORS.
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN?.trim() || 'https://armageddontest.icu';

// Deterministic (linear-time) trimming — avoids regex backtracking on attacker-
// influenced env values while stripping the same characters as before.
function trimTrailingChar(value: string, ch: string): string {
    let end = value.length;
    while (end > 0 && value[end - 1] === ch) end -= 1;
    return value.slice(0, end);
}

const SUPABASE_URL = trimTrailingChar(readSupabaseUrl() ?? '', '/');
const SUPABASE_SERVICE_ROLE_KEY = readSupabaseServiceRoleKey() ?? '';
const ADMIN_EMAIL = readAdminEmail();

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? 'default';
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? 'armageddon-level-7';
// Temporal Cloud (and any shared cluster an operator's Moat setup points at
// instead of a local dev instance) requires an API key + TLS. Unset locally,
// so this is a no-op against the bundled docker-compose.moat.yml `temporal`.
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY || undefined;

// ── Supabase singletons ────────────────────────────────────────────────────────

let _serviceRole: SupabaseClient | null = null;
function getServiceRole(): SupabaseClient {
    if (_serviceRole) return _serviceRole;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_URL (or ARMAGEDDON_DB_URL) or SUPABASE_SERVICE_ROLE_KEY (or ARMAGEDDON_DB_SERVICE_ROLE_KEY)');
    }
    _serviceRole = createServerSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return _serviceRole;
}

// ── Temporal singleton ─────────────────────────────────────────────────────────

let _temporalClient: Client | null = null;
let _temporalPromise: Promise<Client> | null = null;

async function getTemporalClient(): Promise<Client> {
    if (_temporalClient) return _temporalClient;
    if (_temporalPromise) return _temporalPromise;
    _temporalPromise = (async () => {
        const connection = await Connection.connect({
            address: TEMPORAL_ADDRESS,
            ...(TEMPORAL_API_KEY ? { apiKey: TEMPORAL_API_KEY, tls: true } : {}),
        });
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
        'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Vary': 'Origin',
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

// Bound and strip control characters (incl. CR/LF) from any value before it
// reaches a log line — prevents log injection/forging from user-controlled input.
const MAX_LOG_VALUE_LENGTH = 200;

function sanitizeLogValue(value: string): string {
    const raw = value.slice(0, MAX_LOG_VALUE_LENGTH);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0) ?? 0;
        out += (code <= 0x1f || code === 0x7f) ? ' ' : ch;
    }
    return out;
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

function resolveHealthStatus(temporalConnected: boolean, supabaseConnected: boolean): { status: number; statusLabel: string } {
    if (temporalConnected && supabaseConnected) return { status: 200, statusLabel: 'operational' };
    if (temporalConnected !== supabaseConnected) return { status: 207, statusLabel: 'degraded' };
    return { status: 503, statusLabel: 'unavailable' };
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

    const { status, statusLabel } = resolveHealthStatus(temporalConnected, supabaseConnected);

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
const BATTERY_PATTERN = /^B1[0-4]$/;

type BatteryValidation = { ok: true; batteries: string[] } | { ok: false; invalid: string[] };

function validateBatteries(batteries: string[] | undefined): BatteryValidation {
    if (!batteries || batteries.length === 0) return { ok: true, batteries: DEFAULT_BATTERIES };
    const unique = Array.from(new Set(batteries));
    const invalid = unique.filter((b: string) => !BATTERY_PATTERN.test(b));
    if (invalid.length > 0) return { ok: false, invalid };
    return { ok: true, batteries: unique };
}

interface RunPlan { iterations: number; tier: 'CERTIFIED' | 'FREE'; seed: number }

function buildRunPlan(
    organizationId: string,
    runId: string,
    level: number,
    eligibleTier: string | undefined,
    requestedIterations: number | undefined,
): RunPlan {
    const isCertified = eligibleTier === 'certified';
    // God-tier (Level 7 = cloud, Level 8 = air-gapped Moat) runs the full iteration budget.
    const defaultIterations = isCertified && level >= 7 ? 10000 : 2500;
    const iterations = normalizeIterations(requestedIterations ?? defaultIterations);
    // In SIM_MODE always use FREE tier so SimulationAdapter runs (no live LLM calls).
    const tier: 'CERTIFIED' | 'FREE' = (isCertified && process.env.SIM_MODE !== 'true') ? 'CERTIFIED' : 'FREE';
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    const seed = Number.parseInt(digest.slice(0, 8), 16);
    return { iterations, tier, seed };
}

interface StartRunParams {
    runId: string;
    workflowId: string;
    organizationId: string;
    level: number;
    plan: RunPlan;
    batteries: string[];
    targetEndpoint?: string;
}

async function startCertificationRun(res: ServerResponse, supabase: SupabaseClient, params: StartRunParams): Promise<void> {
    const { runId, workflowId, organizationId, plan, batteries, targetEndpoint } = params;

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
            args: [{ runId, organizationId, level: params.level, iterations: plan.iterations, tier: plan.tier, seed: plan.seed, batteries, targetEndpoint }],
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

async function handleRunPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: { organizationId?: string; level?: number; iterations?: number; batteries?: string[]; targetEndpoint?: string };
    try {
        const raw = await readBody(req);
        body = JSON.parse(raw);
    } catch {
        json(res, 400, { success: false, error: 'Invalid JSON body' });
        return;
    }

    const { organizationId, level = 7, batteries } = body;
    const targetEndpoint = typeof body.targetEndpoint === 'string' && body.targetEndpoint.trim() ? body.targetEndpoint.trim() : undefined;
    if (!organizationId) {
        json(res, 400, { success: false, error: 'organizationId is required' });
        return;
    }
    if (targetEndpoint && !(await validateSSRF(targetEndpoint))) {
        json(res, 400, { success: false, error: 'targetEndpoint failed SSRF validation', code: 'SSRF_BLOCKED' });
        return;
    }

    const auth = await authenticate(req);
    if (isAuthErr(auth)) { json(res, auth.status, { success: false, error: auth.error }); return; }
    const { user, supabase } = auth;

    // Org membership check
    const isMember = await verifyMembership(supabase, user.id, organizationId);
    if (!isMember) {
        console.warn(`[Security] User ${sanitizeLogValue(user.id)} not a member of org ${sanitizeLogValue(organizationId)}`);
        json(res, 403, { success: false, error: 'Forbidden: You are not a member of this organization' });
        return;
    }

    // Validate batteries
    const batteryCheck = validateBatteries(batteries);
    if (!batteryCheck.ok) {
        json(res, 400, { success: false, error: `Invalid battery IDs: ${batteryCheck.invalid.join(', ')}` });
        return;
    }
    const validatedBatteries = batteryCheck.batteries;

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

    // Create run record
    const runId = uuidv4();
    const workflowId = `armageddon-${runId}`;
    const plan = buildRunPlan(organizationId, runId, level, eligibility.tier, body.iterations);

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
                iterations: plan.iterations,
                tier: plan.tier,
                seed: plan.seed,
                targetEndpoint,
            },
        });

    if (insertError) {
        console.error('[run] insert failed:', insertError.message);
        json(res, 500, { success: false, error: 'Failed to create run record' });
        return;
    }

    await startCertificationRun(res, supabase, { runId, workflowId, organizationId, level, plan, batteries: validatedBatteries, targetEndpoint });
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
        if (user.email && (user.email === 'jrmendozaceo@apexbusiness-systems.icu' || user.email === ADMIN_EMAIL)) {
            json(res, 200, { eligible: true, tier: 'certified', reason: 'ADMIN_OVERRIDE' });
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

// ── OmniPort connector ──────────────────────────────────────────────────────────
// Inbound OmniHub → Armageddon routes. Every safety gate from the reference
// Next.js implementation is preserved here: OMNIPORT_ENABLED, bearer token,
// SSRF validation on any target URL, waiver JWT + persisted waiver record
// for live-fire, and fail-closed handling on DB/Temporal errors.

type OmniPortGuardErr = { status: 401 | 503; error: string; code: string };

function omniPortGuard(req: IncomingMessage): OmniPortGuardErr | null {
    if (!isOmniPortEnabled()) {
        return { status: 503, error: 'OmniPort connector is disabled on this instance', code: 'OMNIPORT_DISABLED' };
    }
    if (!verifyOmniPortBearerToken(req.headers.authorization)) {
        return { status: 401, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }
    return null;
}

async function persistOmniPortTelemetry(
    supabase: SupabaseClient,
    runId: string,
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    opts: { required?: boolean } = {},
): Promise<void> {
    try {
        const { error } = await supabase.from('omniport_telemetry_events').insert({
            run_id: runId,
            org_id: orgId,
            event_type: eventType,
            payload,
            timestamp: Date.now(),
        });
        if (error) {
            if (opts.required) throw new Error(`Required telemetry '${eventType}' failed to persist: ${error.message}`);
            console.warn('[OmniPort] Telemetry DB write failed (non-fatal):', error.message);
        }
    } catch (err) {
        if (opts.required) throw err;
        console.error('[OmniPort] Telemetry error (non-fatal):', (err as Error).message);
    }
}

// POST /api/omniport/execute — mirrors /api/run, triggered by OmniHub instead of the console.
interface OmniPortExecuteBody {
    organizationId?: unknown;
    level?: unknown;
    iterations?: unknown;
    batteries?: unknown;
    targetUrl?: unknown;
}

interface ValidatedOmniPortExecute {
    organizationId: string;
    level: number;
    iterations: number;
    batteries: string[];
    targetUrl: string;
}

function validateOmniPortExecuteBody(body: OmniPortExecuteBody): { ok: true; value: ValidatedOmniPortExecute } | { ok: false; error: string } {
    if (typeof body.organizationId !== 'string' || !body.organizationId) return { ok: false, error: 'organizationId is required' };
    if (typeof body.level !== 'number' || body.level < 1 || body.level > 7) return { ok: false, error: 'level must be 1-7' };
    if (typeof body.iterations !== 'number' || body.iterations <= 0) return { ok: false, error: 'iterations must be a positive number' };
    if (typeof body.targetUrl !== 'string' || !body.targetUrl) return { ok: false, error: 'targetUrl is required' };
    const batteries = Array.isArray(body.batteries) && body.batteries.every((b) => typeof b === 'string')
        ? body.batteries as string[]
        : DEFAULT_BATTERIES;
    return { ok: true, value: { organizationId: body.organizationId, level: body.level, iterations: body.iterations, batteries, targetUrl: body.targetUrl } };
}

async function handleOmniPortExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const guard = omniPortGuard(req);
    if (guard) { json(res, guard.status, { success: false, error: guard.error, code: guard.code }); return; }

    let raw: OmniPortExecuteBody;
    try {
        raw = JSON.parse(await readBody(req));
    } catch {
        json(res, 400, { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' });
        return;
    }

    const validated = validateOmniPortExecuteBody(raw);
    if (!validated.ok) { json(res, 400, { success: false, error: validated.error, code: 'VALIDATION_ERROR' }); return; }
    const { organizationId, level, iterations, batteries, targetUrl } = validated.value;

    if (!(await validateSSRF(targetUrl))) {
        json(res, 400, { success: false, error: 'targetUrl failed SSRF validation', code: 'SSRF_BLOCKED' });
        return;
    }

    const runId = uuidv4();
    const workflowId = `armageddon-${runId}`;
    const seed = deriveRunSeed(runId, organizationId);
    const omniPortRunRef = `omniport-${organizationId}-${runId}`;

    const supabase = getServiceRole();
    const { error: insertError } = await supabase.from('armageddon_runs').insert({
        id: runId,
        organization_id: organizationId,
        level,
        sim_mode: true,
        sandbox_tenant: process.env.SANDBOX_TENANT ?? 'armageddon-test',
        workflow_id: workflowId,
        status: 'pending',
        config: { batteries, iterations, tier: 'CERTIFIED', seed, omniPortRunRef, targetEndpoint: targetUrl },
    });
    if (insertError) {
        console.error('[OmniPort] Failed to create run record:', insertError.message);
        json(res, 500, { success: false, error: 'Failed to create run record', code: 'DB_INSERT_FAILED' });
        return;
    }

    let client: Client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        console.error('[OmniPort] Temporal unavailable:', (err as Error).message);
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        json(res, 503, { success: false, error: 'Temporal workflow engine unavailable', code: 'TEMPORAL_UNAVAILABLE' });
        return;
    }

    let handle;
    try {
        handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            workflowId,
            taskQueue: resolveOmniPortTaskQueue(organizationId),
            args: [{ runId, organizationId, iterations, tier: 'CERTIFIED', seed, batteries, targetEndpoint: targetUrl }],
        });
    } catch (err) {
        console.error('[OmniPort] Workflow start failed:', (err as Error).message);
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        json(res, 500, { success: false, error: 'Failed to start workflow', code: 'WORKFLOW_START_FAILED' });
        return;
    }

    await supabase.from('armageddon_runs')
        .update({ workflow_run_id: handle.firstExecutionRunId, status: 'running', started_at: new Date().toISOString() })
        .eq('id', runId);

    if (isOmniPortEnabled()) {
        await persistOmniPortTelemetry(supabase, runId, organizationId, 'run.started', { workflowId, level, iterations, omniPortRunRef });
    }

    json(res, 200, { success: true, runId, workflowId, omniPortRunRef });
}

// POST /api/omniport/live-fire — EXCLUSIVE SIM_MODE=false execution path.
// INVARIANT: enforceOmniPortLiveFireGuard is private to this function. It does NOT
// reuse any generic safety-guard helper — that would throw on SIM_MODE=false. No
// other handler in this file may bypass SIM_MODE via this mechanism.
function enforceOmniPortLiveFireGuard(waiverRecordId: string): void {
    if (!process.env.OMNIPORT_LIVE_FIRE_SECRET) {
        throw new Error('LOCKDOWN: OMNIPORT_LIVE_FIRE_SECRET is not set — live-fire authorization denied');
    }
    if (!waiverRecordId) {
        throw new Error('LOCKDOWN: waiverRecordId is empty — live-fire authorization denied');
    }
    console.warn('[OmniPort LIVE-FIRE] Authorized run initiated:', waiverRecordId);
}

interface OmniPortLiveFireBody {
    organizationId?: unknown;
    waiverToken?: unknown;
    level?: unknown;
    iterations?: unknown;
    batteries?: unknown;
    targetUrl?: unknown;
}

interface ValidatedOmniPortLiveFire {
    organizationId: string;
    waiverToken: string;
    level: number;
    iterations: number;
    batteries: string[];
    targetUrl: string;
}

function validateOmniPortLiveFireBody(body: OmniPortLiveFireBody): { ok: true; value: ValidatedOmniPortLiveFire } | { ok: false; error: string } {
    if (typeof body.organizationId !== 'string' || !body.organizationId) return { ok: false, error: 'organizationId is required' };
    if (typeof body.waiverToken !== 'string' || !body.waiverToken) return { ok: false, error: 'waiverToken is required' };
    if (typeof body.level !== 'number' || body.level < 1 || body.level > 7) return { ok: false, error: 'level must be 1-7' };
    if (typeof body.iterations !== 'number' || body.iterations <= 0) return { ok: false, error: 'iterations must be a positive number' };
    if (typeof body.targetUrl !== 'string' || !body.targetUrl) return { ok: false, error: 'targetUrl is required' };
    const batteries = Array.isArray(body.batteries) && body.batteries.every((b) => typeof b === 'string')
        ? body.batteries as string[]
        : DEFAULT_BATTERIES;
    return { ok: true, value: { organizationId: body.organizationId, waiverToken: body.waiverToken, level: body.level, iterations: body.iterations, batteries, targetUrl: body.targetUrl } };
}

async function handleOmniPortLiveFire(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const guard = omniPortGuard(req);
    if (guard) { json(res, guard.status, { success: false, error: guard.error, code: guard.code }); return; }

    let raw: OmniPortLiveFireBody;
    try {
        raw = JSON.parse(await readBody(req));
    } catch {
        json(res, 400, { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' });
        return;
    }

    const validated = validateOmniPortLiveFireBody(raw);
    if (!validated.ok) { json(res, 400, { success: false, error: validated.error, code: 'VALIDATION_ERROR' }); return; }
    const { organizationId, waiverToken, level, iterations, batteries, targetUrl } = validated.value;

    if (!(await validateSSRF(targetUrl))) {
        json(res, 400, { success: false, error: 'targetUrl failed SSRF validation', code: 'SSRF_BLOCKED' });
        return;
    }

    const waiverPayload = verifyWaiverToken(waiverToken);
    if (!waiverPayload) {
        json(res, 401, { authorized: false, reason: 'WAIVER_TOKEN_INVALID_OR_EXPIRED' });
        return;
    }
    if (waiverPayload.orgId !== organizationId) {
        json(res, 403, { authorized: false, reason: 'WAIVER_ORG_MISMATCH', code: 'WAIVER_ORG_MISMATCH' });
        return;
    }
    if (waiverPayload.runLevel !== level) {
        json(res, 403, { authorized: false, reason: 'WAIVER_RUN_LEVEL_MISMATCH', code: 'WAIVER_RUN_LEVEL_MISMATCH' });
        return;
    }

    const waiverTokenHash = createHash('sha256').update(waiverToken).digest('hex');
    const supabase = getServiceRole();

    const { data: waiverRecord, error: waiverError } = await supabase
        .from('omniport_waiver_records')
        .select('id, expires_at, waiver_token_hash')
        .eq('org_id', organizationId)
        .eq('run_level', level)
        .gte('expires_at', new Date().toISOString())
        .order('accepted_at', { ascending: false })
        .limit(1)
        .single();

    if (waiverError || !waiverRecord) {
        json(res, 403, { authorized: false, reason: 'WAIVER_RECORD_NOT_FOUND' });
        return;
    }
    if (waiverRecord.waiver_token_hash !== waiverTokenHash) {
        json(res, 403, { authorized: false, reason: 'WAIVER_TOKEN_HASH_MISMATCH', code: 'WAIVER_TOKEN_HASH_MISMATCH' });
        return;
    }

    try {
        enforceOmniPortLiveFireGuard(waiverRecord.id as string);
    } catch (err) {
        json(res, 403, { authorized: false, reason: 'LIVE_FIRE_GUARD_FAILED', error: (err as Error).message });
        return;
    }

    const runId = uuidv4();
    const workflowId = `armageddon-lf-${runId}`;
    const seed = deriveRunSeed(runId, organizationId);
    const selectedBatteries = batteries.length > 0 ? batteries : DEFAULT_BATTERIES;

    const { error: insertError } = await supabase.from('armageddon_runs').insert({
        id: runId,
        organization_id: organizationId,
        level,
        sim_mode: false,
        // armageddon_runs.sandbox_tenant is NOT NULL; live-fire runs are not
        // sandboxed, so we record an explicit authorized marker instead of null.
        sandbox_tenant: process.env.OMNIPORT_LIVE_FIRE_TENANT || 'live-fire-authorized',
        workflow_id: workflowId,
        status: 'pending',
        config: { batteries: selectedBatteries, iterations, tier: 'CERTIFIED', seed, liveFire: true, waiverRecordId: waiverRecord.id, targetEndpoint: targetUrl },
    });
    if (insertError) {
        console.error('[OmniPort] Live-fire run record insert failed:', insertError.message);
        json(res, 500, { authorized: false, reason: 'DB_INSERT_FAILED', code: 'DB_INSERT_FAILED' });
        return;
    }

    let client: Client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        console.error('[OmniPort] Live-fire Temporal unavailable:', (err as Error).message);
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        json(res, 503, { authorized: false, reason: 'TEMPORAL_UNAVAILABLE', code: 'TEMPORAL_UNAVAILABLE' });
        return;
    }

    let handle;
    try {
        handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            workflowId,
            taskQueue: resolveOmniPortTaskQueue(organizationId),
            args: [{ runId, organizationId, iterations, tier: 'CERTIFIED', seed, batteries: selectedBatteries, targetEndpoint: targetUrl }],
        });
    } catch (err) {
        console.error('[OmniPort] Live-fire workflow start failed:', (err as Error).message);
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        json(res, 500, { authorized: false, reason: 'WORKFLOW_START_FAILED', code: 'WORKFLOW_START_FAILED' });
        return;
    }

    await supabase.from('armageddon_runs')
        .update({ workflow_run_id: handle.firstExecutionRunId, status: 'running', started_at: new Date().toISOString() })
        .eq('id', runId);

    // Proof-critical: if this cannot be persisted we must NOT report authorized: true.
    try {
        await persistOmniPortTelemetry(supabase, runId, organizationId, 'live_fire.authorized', {
            workflowId, level, iterations, waiverRecordId: waiverRecord.id, liveFire: true,
        }, { required: true });
    } catch (err) {
        console.error('[OmniPort] Live-fire proof telemetry failed:', (err as Error).message);
        await supabase.from('armageddon_runs').update({ status: 'failed' }).eq('id', runId);
        json(res, 500, { authorized: false, reason: 'PROOF_PERSIST_FAILED', code: 'PROOF_PERSIST_FAILED', runId });
        return;
    }

    json(res, 200, { authorized: true, runId, workflowId, waiverRecordId: waiverRecord.id, liveFire: true });
}

// POST /api/omniport/control — hot-edit: injects a control signal into an active workflow.
// UNCERTAIN: [signal-handler] — ArmageddonLevel7Workflow only handles the 'cancel' signal
// today; other commands are delivered but not yet actionable (reported truthfully below).
const OMNIPORT_CONTROL_COMMANDS = new Set(['pause', 'resume', 'cancel', 'adjust_iterations', 'inject_battery']);

function isWorkflowNotFound(err: unknown): boolean {
    if (err instanceof Error) {
        return err.constructor.name === 'WorkflowNotFoundError' ||
            err.message.includes('workflow not found') ||
            err.message.includes('Workflow not found');
    }
    return false;
}

async function handleOmniPortControl(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const guard = omniPortGuard(req);
    if (guard) { json(res, guard.status, { success: false, error: guard.error, code: guard.code }); return; }

    let raw: { command?: unknown; runId?: unknown; params?: Record<string, unknown> };
    try {
        raw = JSON.parse(await readBody(req));
    } catch {
        json(res, 400, { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' });
        return;
    }

    if (typeof raw.runId !== 'string' || !raw.runId || typeof raw.command !== 'string' || !OMNIPORT_CONTROL_COMMANDS.has(raw.command)) {
        json(res, 400, { success: false, error: 'Invalid command payload', code: 'VALIDATION_ERROR' });
        return;
    }
    const command = { command: raw.command, runId: raw.runId, params: raw.params };
    const workflowId = `armageddon-${command.runId}`;

    let client: Client;
    try {
        client = await getTemporalClient();
    } catch {
        json(res, 503, { success: false, error: 'Temporal workflow engine unavailable', code: 'TEMPORAL_UNAVAILABLE' });
        return;
    }

    const isCancel = command.command === 'cancel';
    try {
        const handle = client.workflow.getHandle(workflowId);
        if (isCancel) {
            await handle.signal('cancel');
        } else {
            await handle.signal('omniport.control', command);
        }
    } catch (err) {
        if (isWorkflowNotFound(err)) {
            json(res, 404, { acknowledged: false, error: 'RUN_NOT_FOUND', code: 'RUN_NOT_FOUND' });
            return;
        }
        console.error('[OmniPort] Control signal failed:', (err as Error).message);
        json(res, 500, { success: false, error: 'Failed to signal workflow', code: 'SIGNAL_FAILED' });
        return;
    }

    if (isCancel) {
        json(res, 200, { acknowledged: true, actionable: true, runId: command.runId, command: command.command, signalledAt: Date.now() });
        return;
    }
    json(res, 202, {
        acknowledged: true,
        actionable: false,
        runId: command.runId,
        command: command.command,
        note: `'${command.command}' signal delivered but the workflow handler is not yet implemented`,
        signalledAt: Date.now(),
    });
}

// POST /api/omniport/waiver — legal record: persists the live-fire waiver acceptance.
async function handleOmniPortWaiver(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const guard = omniPortGuard(req);
    if (guard) { json(res, guard.status, { success: false, error: guard.error, code: guard.code }); return; }

    let raw: { waiverToken?: unknown; acceptedByUserId?: unknown; organizationId?: unknown };
    try {
        raw = JSON.parse(await readBody(req));
    } catch {
        json(res, 400, { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' });
        return;
    }

    if (typeof raw.waiverToken !== 'string' || !raw.waiverToken ||
        typeof raw.acceptedByUserId !== 'string' || !raw.acceptedByUserId ||
        typeof raw.organizationId !== 'string' || !raw.organizationId) {
        json(res, 400, { success: false, error: 'Invalid waiver payload', code: 'VALIDATION_ERROR' });
        return;
    }
    const { waiverToken, acceptedByUserId, organizationId } = raw as { waiverToken: string; acceptedByUserId: string; organizationId: string };

    const waiverPayload = verifyWaiverToken(waiverToken);
    if (!waiverPayload) {
        json(res, 401, { accepted: false, reason: 'WAIVER_TOKEN_INVALID_OR_EXPIRED' });
        return;
    }
    if (waiverPayload.orgId !== organizationId) {
        json(res, 403, { accepted: false, reason: 'WAIVER_ORG_MISMATCH', code: 'WAIVER_ORG_MISMATCH' });
        return;
    }
    if (waiverPayload.acceptedByUserId !== acceptedByUserId) {
        json(res, 403, { accepted: false, reason: 'WAIVER_USER_MISMATCH', code: 'WAIVER_USER_MISMATCH' });
        return;
    }

    const waiverTokenHash = createHash('sha256').update(waiverToken).digest('hex');
    const supabase = getServiceRole();

    const { data: inserted, error: insertError } = await supabase
        .from('omniport_waiver_records')
        .insert({
            org_id: organizationId,
            user_id: acceptedByUserId,
            waiver_version: '1.0',
            waiver_token_hash: waiverTokenHash,
            run_level: waiverPayload.runLevel,
            expires_at: new Date(waiverPayload.expiresAt).toISOString(),
        })
        .select('id')
        .single();

    if (insertError || !inserted) {
        console.error('[OmniPort] Waiver record insert failed:', insertError?.message);
        json(res, 500, { accepted: false, reason: 'WAIVER_RECORD_INSERT_FAILED', code: 'DB_INSERT_FAILED' });
        return;
    }

    json(res, 200, { accepted: true, waiverRecordId: inserted.id, authorizedUntil: waiverPayload.expiresAt });
}

// GET /api/omniport/telemetry?runId=<uuid> — on-demand pull of cached telemetry events.
async function handleOmniPortTelemetry(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): Promise<void> {
    const guard = omniPortGuard(req);
    if (guard) { json(res, guard.status, { success: false, error: guard.error, code: guard.code }); return; }

    const runId = query.get('runId');
    if (!runId) {
        json(res, 400, { success: false, error: 'runId query parameter is required', code: 'MISSING_RUN_ID' });
        return;
    }

    const supabase = getServiceRole();
    const { data: events, error } = await supabase
        .from('omniport_telemetry_events')
        .select('id, run_id, org_id, event_type, payload, timestamp, created_at')
        .eq('run_id', runId)
        .order('timestamp', { ascending: false })
        .limit(50);

    if (error) {
        json(res, 200, { success: true, runId, events: [], warning: 'telemetry_table_not_initialized' });
        return;
    }

    json(res, 200, { success: true, runId, events: events ?? [], count: (events ?? []).length });
}

// ── Router ─────────────────────────────────────────────────────────────────────

type RouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => void | Promise<void>;

// Method+path → handler. Order is irrelevant: keys are exact `${METHOD} ${path}`
// matches, so dispatch is unambiguous and the fallback is a single 404.
const ROUTES: Record<string, RouteHandler> = {
    'GET /health': (req, res) => handleLiveness(req, res),
    'GET /ready': (req, res) => handleReadiness(req, res),
    'GET /api/omniport/health': (req, res) => handleHealth(req, res),
    'GET /api/me/organizations': (req, res) => handleOrganizations(req, res),
    'POST /api/run': (req, res) => handleRunPost(req, res),
    'GET /api/run': (req, res, url) => handleRunGet(req, res, url.searchParams),
    'POST /api/gatekeeper': (req, res) => handleGatekeeper(req, res),
    'GET /api/attestation/pubkey': (req, res) => handleAttestationPubkey(req, res),
    'POST /api/omniport/execute': (req, res) => handleOmniPortExecute(req, res),
    'POST /api/omniport/live-fire': (req, res) => handleOmniPortLiveFire(req, res),
    'POST /api/omniport/control': (req, res) => handleOmniPortControl(req, res),
    'POST /api/omniport/waiver': (req, res) => handleOmniPortWaiver(req, res),
    'GET /api/omniport/telemetry': (req, res, url) => handleOmniPortTelemetry(req, res, url.searchParams),
};

function writeCorsPreflight(res: ServerResponse): void {
    res.writeHead(204, {
        'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Vary': 'Origin',
    });
    res.end();
}

async function router(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    // CORS preflight
    if (method === 'OPTIONS') {
        writeCorsPreflight(res);
        return;
    }

    const handler = ROUTES[`${method} ${path}`];
    try {
        if (handler) {
            await handler(req, res, url);
            return;
        }
        json(res, 404, { error: 'Not found', path });
    } catch (err) {
        console.error(`[${sanitizeLogValue(method)} ${sanitizeLogValue(path)}] Unhandled error:`, (err as Error).message);
        json(res, 500, { error: 'Internal server error' });
    }
}

// ── Pending run dispatcher ─────────────────────────────────────────────────────
// Polls Supabase every POLL_MS for runs with status='pending' and dispatches them
// to Temporal via gRPC. This enables the Cloudflare Worker edge to create pending
// runs without needing gRPC (which is unavailable on the CF edge runtime).

const PENDING_POLL_MS = 5000;
const PENDING_CLAIM_WINDOW_MS = 10 * 60 * 1000; // only pick up runs < 10 min old

interface PendingRun {
    id: string;
    organization_id: string;
    level: number;
    config: unknown;
    workflow_id: string;
}

async function dispatchPendingRun(sb: SupabaseClient, client: Client, run: PendingRun): Promise<void> {
    const cfg = (run.config ?? {}) as { batteries?: string[]; iterations?: number; tier?: string; seed?: number; targetModel?: string; targetEndpoint?: string };
    const { batteries = DEFAULT_BATTERIES, iterations = 2500, tier = 'FREE', seed = 0, targetModel = 'sim-001', targetEndpoint } = cfg;
    const workflowTier = (tier === 'certified' && process.env.SIM_MODE !== 'true') ? 'CERTIFIED' : 'FREE';
    // Only forward a real model when tier is actually CERTIFIED; force sim-001 otherwise.
    const resolvedTargetModel = workflowTier === 'CERTIFIED' ? (targetModel || 'claude-sonnet-4-6') : 'sim-001';

    try {
        const handle = await client.workflow.start('ArmageddonLevel7Workflow', {
            workflowId: run.workflow_id,
            taskQueue: TEMPORAL_TASK_QUEUE,
            args: [{ runId: run.id, organizationId: run.organization_id, level: run.level, iterations, tier: workflowTier, seed, batteries, targetModel: resolvedTargetModel, targetEndpoint }],
        });

        await sb.from('armageddon_runs')
            .update({ status: 'running', workflow_run_id: handle.firstExecutionRunId, started_at: new Date().toISOString() })
            .eq('id', run.id)
            .eq('status', 'pending');

        console.log(`[PendingLoop] Dispatched run ${run.id} → workflow ${run.workflow_id}`);
    } catch (err) {
        const name = (err as Error).name ?? '';
        // Another dispatcher already claimed this run — leave it alone
        if (name === 'WorkflowExecutionAlreadyStartedError') return;
        console.error(`[PendingLoop] Failed to dispatch run ${run.id}:`, (err as Error).message);
        await sb.from('armageddon_runs').update({ status: 'failed' }).eq('id', run.id).eq('status', 'pending');
    }
}

async function pollPendingRunsOnce(): Promise<void> {
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
        return;
    }
    if (!pendingRuns?.length) return;

    let client: Client;
    try {
        client = await getTemporalClient();
    } catch (err) {
        console.warn('[PendingLoop] Temporal not ready:', (err as Error).message);
        return;
    }

    for (const run of pendingRuns) {
        await dispatchPendingRun(sb, client, run as PendingRun);
    }
}

async function startPendingRunsLoop(): Promise<void> {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[PendingLoop] Missing Supabase credentials — dispatcher disabled.');
        return;
    }
    console.log('[PendingLoop] Pending run dispatcher started.');

    while (true) {
        await new Promise<void>(resolve => setTimeout(resolve, PENDING_POLL_MS));
        try {
            await pollPendingRunsOnce();
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
