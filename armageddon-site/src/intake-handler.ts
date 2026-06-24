type IntakeEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CANONICAL_HOST?: string;
  ADMIN_EMAIL?: string;
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

  // Temporal requires a Node.js gRPC runtime — not available in Cloudflare Workers edge.
  const temporalConnected = false;
  const temporalError = 'Temporal gRPC client requires Node.js runtime (not deployed to edge)';

  const status = supabaseConnected ? 'degraded' : 'unavailable';
  const httpStatus = supabaseConnected ? 207 : 503;

  return jsonResponse({
    status,
    version: '1.0.0',
    simMode: false,
    temporalConnected,
    temporalError,
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

function handleRunStub(_request: Request, canonicalHost: string): Response {
  // /api/run requires Temporal workflow orchestration (gRPC, Node.js runtime).
  // It cannot execute in the Cloudflare Workers edge runtime.
  // Deploy the Next.js server (packages/moat or a standalone Node.js container)
  // and point NEXT_PUBLIC_ARMAGEDDON_API_BASE at it to enable live runs.
  return jsonResponse({
    success: false,
    error: 'Run execution requires Temporal runtime (Node.js). Deploy the armageddon-moat server to enable /api/run.',
  }, canonicalHost, 503);
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
        return handleRunStub(request, canonicalHost);
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
