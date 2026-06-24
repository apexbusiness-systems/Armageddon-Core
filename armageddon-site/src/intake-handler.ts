type IntakeEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CANONICAL_HOST?: string;
  ADMIN_EMAIL?: string;
  // Temporal Cloud — used by /api/run to start workflows via HTTP API
  TEMPORAL_ADDRESS?: string;   // e.g. armageddon-prod.smvtx.tmprl.cloud:7233
  TEMPORAL_API_KEY?: string;
  TEMPORAL_NAMESPACE?: string; // e.g. armageddon-prod.smvtx
  TEMPORAL_TASK_QUEUE?: string;
};

type IntakePayload = {
  system_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  company?: unknown;
  tier?: unknown;
  description?: unknown;
  source?: unknown;
};

type FieldErrors = Partial<Record<keyof IntakePayload, string>>;

interface SupabaseUser {
  id: string;
  email?: string;
}

interface OrgMembership {
  organization_id: string;
  role: string;
}

const ALLOWED_TIERS = new Set(['Self-Serve', 'Verified', 'Certified', 'Enterprise']);
const DEFAULT_CANONICAL_HOST = 'armageddon.icu';
const MAX_LENGTHS: Record<keyof Required<IntakePayload>, number> = {
  system_name: 160,
  contact_name: 160,
  email: 254,
  company: 180,
  tier: 32,
  description: 4000,
  source: 240,
};

// ── Shared response helpers ───────────────────────────────────────────────────

function withProductionHeaders(response: Response, canonicalHost: string): Response {
  const headers = new Headers(response.headers);
  headers.set('x-armageddon-edge', 'cloudflare-workers');
  headers.set('x-armageddon-canonical-host', canonicalHost);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function canonicalRedirect(url: URL, canonicalHost: string): Response | null {
  if (url.hostname !== `www.${canonicalHost}`) return null;
  const canonicalUrl = new URL(url);
  canonicalUrl.hostname = canonicalHost;
  return withProductionHeaders(Response.redirect(canonicalUrl.toString(), 301), canonicalHost);
}

function jsonResponse(body: unknown, canonicalHost: string, status = 200): Response {
  return withProductionHeaders(new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  }), canonicalHost);
}

// ── Supabase REST helpers (no SDK import — pure fetch) ───────────────────────

function supabaseBase(env: IntakeEnv): string {
  let url = env.SUPABASE_URL ?? '';
  while (url.endsWith('/')) url = url.slice(0, -1);
  return url;
}

async function getSupabaseUser(env: IntakeEnv, token: string): Promise<SupabaseUser | null> {
  const res = await fetch(`${supabaseBase(env)}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  return res.json() as Promise<SupabaseUser>;
}

async function supabaseQuery<T>(
  env: IntakeEnv,
  table: string,
  params: string,
): Promise<{ data: T[] | null; error: string | null }> {
  const res = await fetch(`${supabaseBase(env)}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    return { data: null, error: body.slice(0, 200) };
  }
  return { data: (await res.json()) as T[], error: null };
}

async function supabaseInsert(
  env: IntakeEnv,
  table: string,
  row: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const res = await fetch(`${supabaseBase(env)}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: body.slice(0, 200) };
  }
  return { error: null };
}

async function supabaseUpdate(
  env: IntakeEnv,
  table: string,
  updates: Record<string, unknown>,
  filter: string,
): Promise<{ error: string | null }> {
  const res = await fetch(`${supabaseBase(env)}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: body.slice(0, 200) };
  }
  return { error: null };
}

/** Extracts the Bearer token from the Authorization header. Returns null if missing. */
function extractBearer(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

// ── API Handlers ──────────────────────────────────────────────────────────────

async function handleMeOrganizations(request: Request, env: IntakeEnv, canonicalHost: string): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, canonicalHost, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Auth service not configured.' }, canonicalHost, 500);
  }

  const token = extractBearer(request);
  if (!token) return jsonResponse({ success: false, error: 'Unauthorized: Missing token' }, canonicalHost, 401);

  const user = await getSupabaseUser(env, token);
  if (!user) return jsonResponse({ success: false, error: 'Unauthorized: Invalid token' }, canonicalHost, 401);

  const { data, error } = await supabaseQuery<OrgMembership>(
    env,
    'organization_members',
    `select=organization_id,role&user_id=eq.${encodeURIComponent(user.id)}`,
  );

  if (error) return jsonResponse({ success: false, error }, canonicalHost, 500);
  const memberships = data ?? [];
  if (memberships.length === 0) {
    return jsonResponse({ success: false, error: 'No organization membership', organizations: [] }, canonicalHost, 404);
  }

  const active = memberships.find(m => m.role === 'owner' || m.role === 'admin') ?? memberships[0];
  return jsonResponse({ success: true, organizations: memberships, active }, canonicalHost);
}

async function handleOmniportHealth(request: Request, env: IntakeEnv, canonicalHost: string): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, canonicalHost, 405);

  let supabaseConnected = false;
  let supabaseError: string | undefined;
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const { error } = await supabaseQuery(env, 'armageddon_runs', 'select=id&limit=1');
    if (error) {
      supabaseError = error;
    } else {
      supabaseConnected = true;
    }
  } else {
    supabaseError = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured';
  }

  // Check Temporal Cloud reachability via its HTTP API (no gRPC needed from edge).
  let temporalConnected = false;
  let temporalError: string | undefined;
  const tHost = temporalHost(env);
  const tNamespace = env.TEMPORAL_NAMESPACE ?? '';
  const tApiKey = env.TEMPORAL_API_KEY ?? '';
  if (tHost && tNamespace && tApiKey) {
    try {
      const tRes = await fetch(
        `https://${tHost}/api/v1/namespaces/${encodeURIComponent(tNamespace)}`,
        {
          headers: {
            Authorization: `Bearer ${tApiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      // 200 = connected; 400/401/403 = server reachable (auth/input issue); 415 = wrong content-type but server alive
      if (tRes.ok || tRes.status === 400 || tRes.status === 401 || tRes.status === 403 || tRes.status === 415) {
        temporalConnected = true;
      } else {
        temporalError = `Temporal HTTP ${tRes.status}`;
      }
    } catch (err) {
      temporalError = err instanceof Error ? err.message : 'Temporal unreachable';
    }
  } else {
    temporalError = 'Temporal Cloud not configured (TEMPORAL_ADDRESS/NAMESPACE/API_KEY)';
  }

  const status = (supabaseConnected && temporalConnected) ? 'operational'
    : (supabaseConnected || temporalConnected) ? 'degraded' : 'unavailable';
  const httpStatus = status === 'operational' ? 200 : status === 'degraded' ? 207 : 503;

  return jsonResponse({
    status,
    version: '1.0.0',
    simMode: false,
    temporalConnected,
    ...(temporalError ? { temporalError } : {}),
    supabaseConnected,
    ...(supabaseError ? { supabaseError } : {}),
    omniPortEnabled: true,
    timestamp: Date.now(),
  }, canonicalHost, httpStatus);
}

async function handleGatekeeper(request: Request, env: IntakeEnv, canonicalHost: string): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, canonicalHost, 405);

  const token = extractBearer(request);
  if (token && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const user = await getSupabaseUser(env, token);
    if (user?.email && env.ADMIN_EMAIL && user.email === env.ADMIN_EMAIL) {
      return jsonResponse({ eligible: true, tier: 'verified', reason: 'ADMIN_OVERRIDE' }, canonicalHost);
    }
  }

  return jsonResponse({ eligible: false, tier: 'free', reason: 'LEVEL_7_ACCESS_REQUIRED' }, canonicalHost);
}

// ── Tier / eligibility helpers (edge-compatible, no SDK import) ───────────────

interface OrgRow { current_tier: string }

const TIER_LEVEL_ACCESS: Record<string, number[]> = {
  free_dry: [1, 2, 3],
  verified: [1, 2, 3, 4, 5, 6],
  certified: [1, 2, 3, 4, 5, 6, 7],
};
const TIER_CAN_CUSTOMIZE: Record<string, boolean> = {
  free_dry: false,
  verified: true,
  certified: true,
};
const ALLOWED_BATTERIES = new Set(['B10', 'B11', 'B12', 'B13', 'B14']);
const DEFAULT_BATTERIES = ['B10', 'B11', 'B12', 'B13', 'B14'];

// ── Temporal Cloud HTTP API helper ────────────────────────────────────────────

function temporalHost(env: IntakeEnv): string {
  // Temporal HTTP/REST API runs on port 7243 (gRPC is on 7233).
  // Replace the gRPC port with the HTTP API port.
  return (env.TEMPORAL_ADDRESS ?? '')
    .replace(/:7233$/, ':7243')
    .replace(/:443$/, '');
}

async function temporalStartWorkflow(
  env: IntakeEnv,
  workflowId: string,
  workflowType: string,
  args: unknown[],
): Promise<{ runId: string | null; error: string | null }> {
  const host = temporalHost(env);
  const namespace = env.TEMPORAL_NAMESPACE ?? '';
  const taskQueue = env.TEMPORAL_TASK_QUEUE ?? 'armageddon-certification';
  const apiKey = env.TEMPORAL_API_KEY ?? '';

  if (!host || !namespace || !apiKey) {
    return { runId: null, error: 'Temporal Cloud not configured (missing TEMPORAL_ADDRESS/NAMESPACE/API_KEY)' };
  }

  const payloads = args.map((arg) => ({
    metadata: { encoding: btoa('json/plain') },
    data: btoa(JSON.stringify(arg)),
  }));

  const url = `https://${host}/api/v1/namespaces/${encodeURIComponent(namespace)}/workflows/${encodeURIComponent(workflowId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      workflowType: { name: workflowType },
      taskQueue: { name: taskQueue },
      input: { payloads },
      workflowExecutionTimeout: '3600s',
      workflowRunTimeout: '3600s',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { runId: null, error: `Temporal HTTP ${res.status}: ${body.slice(0, 200)}` };
  }
  const data = await res.json() as { runId?: string };
  return { runId: data.runId ?? workflowId, error: null };
}

// ── /api/run handler ──────────────────────────────────────────────────────────

async function handleRun(request: Request, env: IntakeEnv, canonicalHost: string): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, canonicalHost, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Auth service not configured.' }, canonicalHost, 500);
  }

  const token = extractBearer(request);
  if (!token) return jsonResponse({ success: false, error: 'Unauthorized: Missing token' }, canonicalHost, 401);

  const user = await getSupabaseUser(env, token);
  if (!user) return jsonResponse({ success: false, error: 'Unauthorized: Invalid token' }, canonicalHost, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, canonicalHost, 400);
  }

  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : null;
  const level = typeof body.level === 'number' ? body.level : 1;
  const requestedBatteries = Array.isArray(body.batteries)
    ? (body.batteries as unknown[]).filter((b): b is string => typeof b === 'string')
    : null;

  if (!organizationId) {
    return jsonResponse({ error: 'organizationId is required.' }, canonicalHost, 400);
  }
  if (level < 1 || level > 7) {
    return jsonResponse({ error: 'level must be 1–7.' }, canonicalHost, 400);
  }

  // Verify user is member of the org
  const { data: memberships } = await supabaseQuery<OrgMembership>(
    env, 'organization_members',
    `select=organization_id,role&user_id=eq.${encodeURIComponent(user.id)}&organization_id=eq.${encodeURIComponent(organizationId)}`,
  );
  if (!memberships || memberships.length === 0) {
    return jsonResponse({ success: false, error: 'ACCESS_DENIED: Not a member of this organization.' }, canonicalHost, 403);
  }

  // Fetch org tier
  const { data: orgs } = await supabaseQuery<OrgRow>(
    env, 'organizations',
    `select=current_tier&id=eq.${encodeURIComponent(organizationId)}`,
  );
  const tier = orgs?.[0]?.current_tier ?? 'free_dry';

  // Level eligibility
  if (!(TIER_LEVEL_ACCESS[tier] ?? []).includes(level)) {
    return jsonResponse({
      success: false,
      error: 'ACCESS_DENIED',
      upsellMessage: `Level ${level} is not available on your current plan.`,
      upgradeUrl: '/pricing',
    }, canonicalHost, 403);
  }

  // Battery selection
  const batteries = requestedBatteries && requestedBatteries.length > 0
    ? requestedBatteries
    : DEFAULT_BATTERIES;

  const isCustomized = batteries.length !== DEFAULT_BATTERIES.length ||
    !batteries.every((b) => DEFAULT_BATTERIES.includes(b));

  if (isCustomized && !TIER_CAN_CUSTOMIZE[tier]) {
    return jsonResponse({
      success: false,
      error: 'FEATURE_LOCKED',
      upsellMessage: 'Custom battery selection requires Verified tier.',
      upgradeUrl: '/pricing?upgrade=verified',
    }, canonicalHost, 403);
  }

  const invalidBatteries = batteries.filter((b) => !ALLOWED_BATTERIES.has(b));
  if (invalidBatteries.length > 0) {
    return jsonResponse({
      success: false,
      error: 'INVALID_BATTERIES',
      message: `Unknown batteries: ${invalidBatteries.join(', ')}`,
    }, canonicalHost, 400);
  }

  // Create run record
  const runId = crypto.randomUUID();
  const workflowId = `armageddon-${runId}`;
  const iterations = 2500;
  const seed = Math.floor(Math.random() * (2 ** 32));

  const { error: insertError } = await supabaseInsert(env, 'armageddon_runs', {
    id: runId,
    organization_id: organizationId,
    level,
    sim_mode: false,
    sandbox_tenant: 'armageddon-prod',
    workflow_id: workflowId,
    status: 'pending',
    config: { batteries, iterations, tier: 'FREE', seed },
  });

  if (insertError) {
    return jsonResponse({ success: false, error: 'Failed to create run record.' }, canonicalHost, 500);
  }

  // Run is now 'pending' — the Node.js api-server polls Supabase for pending runs and
  // dispatches them to Temporal via gRPC (which cannot run on the CF Workers edge).
  return jsonResponse({ success: true, runId, workflowId }, canonicalHost);
}

// ── Intake form handler (unchanged) ──────────────────────────────────────────

function stripHtml(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(email: string): boolean {
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

function validatePayload(payload: IntakePayload): { clean: Required<Record<keyof IntakePayload, string>>; fieldErrors: FieldErrors } {
  const clean = {
    system_name: stripHtml(payload.system_name, MAX_LENGTHS.system_name),
    contact_name: stripHtml(payload.contact_name, MAX_LENGTHS.contact_name),
    email: stripHtml(payload.email, MAX_LENGTHS.email).toLowerCase(),
    company: stripHtml(payload.company, MAX_LENGTHS.company),
    tier: stripHtml(payload.tier, MAX_LENGTHS.tier),
    description: stripHtml(payload.description, MAX_LENGTHS.description),
    source: stripHtml(payload.source, MAX_LENGTHS.source),
  };
  const fieldErrors: FieldErrors = {};
  if (!clean.system_name) fieldErrors.system_name = 'System name is required.';
  if (!clean.contact_name) fieldErrors.contact_name = 'Contact name is required.';
  if (!clean.email) fieldErrors.email = 'Email is required.';
  if (clean.email && !isValidEmail(clean.email)) fieldErrors.email = 'Enter a valid email address.';
  if (!clean.tier || !ALLOWED_TIERS.has(clean.tier)) fieldErrors.tier = 'Select a valid audit tier.';
  if (!clean.description) fieldErrors.description = 'System description is required.';
  return { clean, fieldErrors };
}

async function parseJson(request: Request): Promise<IntakePayload | null> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return null;
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as IntakePayload) : null;
  } catch {
    return null;
  }
}

async function handleIntake(request: Request, env: IntakeEnv, canonicalHost: string): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, canonicalHost, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Intake service is not configured.' }, canonicalHost, 500);
  }

  const payload = await parseJson(request);
  if (!payload) return jsonResponse({ error: 'Invalid JSON request body.' }, canonicalHost, 400);

  const { clean, fieldErrors } = validatePayload(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return jsonResponse({ error: 'Validation failed.', fieldErrors }, canonicalHost, 400);
  }

  const response = await fetch(`${supabaseBase(env)}/rest/v1/armageddon_intake`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(clean),
  });

  if (!response.ok) return jsonResponse({ error: 'Unable to save intake request.' }, canonicalHost, 500);
  return jsonResponse({ success: true }, canonicalHost);
}

function intakeAssetRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = '/intake/index.html';
  return new Request(url, request);
}

// ── Worker entry point ────────────────────────────────────────────────────────

const intakeWorker = {
  async fetch(request: Request, env: IntakeEnv): Promise<Response> {
    const canonicalHost = env.CANONICAL_HOST?.trim() || DEFAULT_CANONICAL_HOST;
    const url = new URL(request.url);

    const redirect = canonicalRedirect(url, canonicalHost);
    if (redirect) return redirect;

    // Dynamic API routes — handled before ASSETS so they return JSON, not HTML.
    switch (url.pathname) {
      case '/api/intake':
        return handleIntake(request, env, canonicalHost);
      case '/api/me/organizations':
        return handleMeOrganizations(request, env, canonicalHost);
      case '/api/omniport/health':
        return handleOmniportHealth(request, env, canonicalHost);
      case '/api/gatekeeper':
        return handleGatekeeper(request, env, canonicalHost);
      case '/api/run':
        return handleRun(request, env, canonicalHost);
      default:
        break;
    }

    if (url.pathname === '/intake') {
      return withProductionHeaders(await env.ASSETS.fetch(intakeAssetRequest(request)), canonicalHost);
    }

    return withProductionHeaders(await env.ASSETS.fetch(request), canonicalHost);
  },
};

export default intakeWorker;
