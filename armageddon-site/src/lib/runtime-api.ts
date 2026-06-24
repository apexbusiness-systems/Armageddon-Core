/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RUNTIME API SAFETY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The production site ships as a Cloudflare static export. The dynamic Next.js
 * App Router routes under `src/app/api/**` are NOT deployed to the static edge
 * (only the Worker-backed `/api/intake` exists). Any component that needs the
 * live run / gatekeeper / attestation / omniport backend must therefore call an
 * EXTERNAL backend whose origin is provided at build time via
 * `NEXT_PUBLIC_ARMAGEDDON_API_BASE`.
 *
 * When that base is not configured, API-backed actions must degrade honestly —
 * never fabricate runs, verdicts, attestations, or certificates.
 */

function normalizeBase(raw: string | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;

    // Strip trailing slashes without regex backtracking.
    let end = trimmed.length;
    while (end > 0 && trimmed.charCodeAt(end - 1) === 47) {
        end -= 1;
    }
    const base = trimmed.slice(0, end);

    try {
        const url = new URL(base);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    } catch {
        return null;
    }
    return base;
}

// Read at call time so the value is driven by the (build-inlined) public env.
// Next.js statically replaces `process.env.NEXT_PUBLIC_*`, so this stays a
// constant in production while remaining overridable in unit tests.
function computeApiBase(): string | null {
    return normalizeBase(process.env.NEXT_PUBLIC_ARMAGEDDON_API_BASE);
}

/** Configured external backend origin, or null when no backend is wired up. */
export function getApiBase(): string | null {
    return computeApiBase();
}

/** True when a real Armageddon backend origin is configured for this build. */
export function isApiConfigured(): boolean {
    return computeApiBase() !== null;
}

/** Build a fully-qualified backend URL, or null when no backend is configured. */
export function apiUrl(path: string): string | null {
    const base = computeApiBase();
    if (base === null) return null;
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
}

/** Thrown when an API-backed action is attempted without a configured backend. */
export class ApiUnavailableError extends Error {
    constructor() {
        super('The Armageddon backend is not connected on this deployment.');
        this.name = 'ApiUnavailableError';
    }
}

/**
 * fetch() against the configured backend. Throws ApiUnavailableError when the
 * backend is not configured so callers can show honest, recoverable copy
 * instead of hitting a route that does not exist in the static export.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const url = apiUrl(path);
    if (url === null) {
        throw new ApiUnavailableError();
    }
    return fetch(url, init);
}
