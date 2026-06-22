type IntakeEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // Optional override so one worker codebase can serve multiple zones
  // (e.g. armageddon.icu and armageddontest.icu). Defaults to armageddon.icu.
  CANONICAL_HOST?: string;
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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, canonicalHost, 405);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Intake service is not configured.' }, canonicalHost, 500);
  }

  const payload = await parseJson(request);
  if (!payload) {
    return jsonResponse({ error: 'Invalid JSON request body.' }, canonicalHost, 400);
  }

  const { clean, fieldErrors } = validatePayload(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return jsonResponse({ error: 'Validation failed.', fieldErrors }, canonicalHost, 400);
  }

  let supabaseUrl = env.SUPABASE_URL;
  while (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
  const response = await fetch(`${supabaseUrl}/rest/v1/armageddon_intake`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(clean),
  });

  if (!response.ok) {
    // Avoid returning database details or secrets to the browser.
    return jsonResponse({ error: 'Unable to save intake request.' }, canonicalHost, 500);
  }

  return jsonResponse({ success: true }, canonicalHost);
}

function intakeAssetRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = '/intake/index.html';
  return new Request(url, request);
}

const intakeWorker = {
  async fetch(request: Request, env: IntakeEnv): Promise<Response> {
    const canonicalHost = env.CANONICAL_HOST?.trim() || DEFAULT_CANONICAL_HOST;
    const url = new URL(request.url);

    const redirect = canonicalRedirect(url, canonicalHost);
    if (redirect) return redirect;

    if (url.pathname === '/api/intake') {
      return handleIntake(request, env, canonicalHost);
    }

    if (url.pathname === '/intake') {
      return withProductionHeaders(await env.ASSETS.fetch(intakeAssetRequest(request)), canonicalHost);
    }

    return withProductionHeaders(await env.ASSETS.fetch(request), canonicalHost);
  },
};

export default intakeWorker;
