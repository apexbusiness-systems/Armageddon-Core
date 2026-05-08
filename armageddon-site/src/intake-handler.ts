type IntakeEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
const MAX_LENGTHS: Record<keyof Required<IntakePayload>, number> = {
  system_name: 160,
  contact_name: 160,
  email: 254,
  company: 180,
  tier: 32,
  description: 4000,
  source: 240,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function stripHtml(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

async function handleIntake(request: Request, env: IntakeEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Intake service is not configured.' }, 500);
  }

  const payload = await parseJson(request);
  if (!payload) {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const { clean, fieldErrors } = validatePayload(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return jsonResponse({ error: 'Validation failed.', fieldErrors }, 400);
  }

  const supabaseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
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
    return jsonResponse({ error: 'Unable to save intake request.' }, 500);
  }

  return jsonResponse({ success: true });
}

function intakeAssetRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = '/intake/index.html';
  return new Request(url, request);
}

export default {
  async fetch(request: Request, env: IntakeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/intake') {
      return handleIntake(request, env);
    }

    if (url.pathname === '/intake') {
      return env.ASSETS.fetch(intakeAssetRequest(request));
    }

    return env.ASSETS.fetch(request);
  },
};
