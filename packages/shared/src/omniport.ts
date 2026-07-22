/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED OMNIPORT INBOUND PRIMITIVES
 *
 * Single source of truth for the auth/crypto primitives the OmniPort
 * connector needs on every surface that accepts an inbound OmniHub request:
 * today that's the Next.js Node-runtime routes (`armageddon-site/src/lib/
 * omniport.ts`), and — once wired in — the standalone Node API server
 * (`packages/core/src/api-server.ts`), which is the only process with real
 * Temporal gRPC access in production (Cloudflare Workers cannot do gRPC).
 *
 * Before this module existed, `armageddon-site` carried its own private copy
 * of this logic (SSRF validation, waiver JWT verify, bearer token check)
 * because `armageddon-core` was not a workspace dependency of
 * `armageddon-site`. `@armageddon/shared` is a dependency of both, so this
 * is the one place that logic can live without drifting: if the SSRF
 * allowlist or the waiver signature check ever diverged between two
 * copies, a live-fire authorization bug could silently open up on one
 * surface while looking fixed on the other.
 *
 * Depends only on Node built-ins (`node:crypto`, `node:dns/promises`,
 * `node:net`) — no zod, no framework types — so it stays usable from both a
 * Next.js Node-runtime route and a plain `node:http` server.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// ─── SSRF validation ────────────────────────────────────────────────────────

function parseIPv4Address(hostname: string): string | null {
    const host = hostname.toLowerCase();
    if (/^\d+$/.test(host)) {
        const value = Number(host);
        if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff) {
            return [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
        }
    }

    const parts = host.split('.');
    if (parts.length === 4 && parts.every(part => /^\d+$/.test(part))) {
        const octets = parts.map(Number);
        if (octets.every(octet => octet >= 0 && octet <= 255)) return octets.join('.');
    }

    return null;
}

function isBlockedIpAddress(address: string): boolean {
    const ipVersion = isIP(address);
    if (ipVersion === 4) {
        const parsed = parseIPv4Address(address);
        if (!parsed) return true;
        const [a, b] = parsed.split('.').map(Number) as [number, number, number, number];
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            a === 169 && b === 254 ||
            a === 172 && b >= 16 && b <= 31 ||
            a === 192 && b === 168 ||
            a >= 224
        );
    }

    if (ipVersion === 6) {
        const normalized = address.toLowerCase();
        return (
            normalized === '::1' ||
            normalized === '::' ||
            normalized.startsWith('fc') ||
            normalized.startsWith('fd') ||
            normalized.startsWith('fe8') ||
            normalized.startsWith('fe9') ||
            normalized.startsWith('fea') ||
            normalized.startsWith('feb')
        );
    }

    return true;
}

/** Rejects loopback/private/link-local/multicast targets and non-http(s) schemes. */
export async function validateSSRF(url: string): Promise<boolean> {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

        const ALLOWED_PORTS = new Set([80, 443, 8080, 8443, 3000]);
        let port: number;
        if (parsed.port) {
            port = Number(parsed.port);
        } else if (parsed.protocol === 'https:') {
            port = 443;
        } else {
            port = 80;
        }
        if (!ALLOWED_PORTS.has(port)) return false;

        const hostname = parsed.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;

        const decodedHostname = decodeURIComponent(hostname);
        const directIPv4 = parseIPv4Address(decodedHostname);
        if (directIPv4) return !isBlockedIpAddress(directIPv4);
        if (isIP(decodedHostname)) return !isBlockedIpAddress(decodedHostname);

        const results = await lookup(decodedHostname, { all: true, verbatim: true });
        if (results.length === 0) return false;
        return results.every(result => !isBlockedIpAddress(result.address));
    } catch {
        return false;
    }
}

// ─── OMNIPORT_ENABLED guard ────────────────────────────────────────────────

export function isOmniPortEnabled(): boolean {
    return process.env.OMNIPORT_ENABLED === 'true';
}

// ─── Bearer token verification ─────────────────────────────────────────────

/** Timing-safe check of an `Authorization: Bearer <token>` header against OMNIPORT_API_KEY. */
export function verifyOmniPortBearerToken(authHeader: string | null | undefined): boolean {
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    const apiKey = process.env.OMNIPORT_API_KEY;
    if (!apiKey || !token) return false;
    const keyBuf = Buffer.from(apiKey, 'utf8');
    const tokBuf = Buffer.from(token, 'utf8');
    const keyHash = createHash('sha256').update(keyBuf).digest();
    const tokHash = createHash('sha256').update(tokBuf).digest();
    return timingSafeEqual(keyHash, tokHash);
}

// ─── Webhook signature verification ───────────────────────────────────────

export function verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.OMNIPORT_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
}

// ─── Telemetry payload signing ─────────────────────────────────────────────

export function signTelemetryPayload(payload: string): string {
    const secret = process.env.OMNIPORT_WEBHOOK_SECRET;
    if (!secret) throw new Error('OMNIPORT_WEBHOOK_SECRET not configured');
    return createHmac('sha256', secret).update(payload).digest('hex');
}

// ─── Waiver JWT verification (HS256, built-in crypto only) ────────────────

export interface WaiverTokenPayload {
    orgId: string;
    issuedAt: number;
    expiresAt: number;
    runLevel: number;
    acceptedByUserId: string;
    waiverVersion: '1.0';
}

function isWaiverTokenPayload(value: unknown): value is WaiverTokenPayload {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.orgId === 'string' && v.orgId.length > 0 &&
        Number.isInteger(v.issuedAt) &&
        Number.isInteger(v.expiresAt) &&
        Number.isInteger(v.runLevel) && (v.runLevel as number) >= 1 && (v.runLevel as number) <= 7 &&
        typeof v.acceptedByUserId === 'string' && v.acceptedByUserId.length > 0 &&
        v.waiverVersion === '1.0'
    );
}

function base64urlToBuffer(str: string): Buffer {
    // Convert base64url → base64 → Buffer
    const padded = str.replaceAll('-', '+').replaceAll('_', '/') + '=='.slice((str.length + 3) % 4 || 4);
    return Buffer.from(padded, 'base64');
}

export function verifyWaiverToken(token: string): WaiverTokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, signatureB64] = parts;

        const secret = process.env.OMNIPORT_LIVE_FIRE_SECRET;
        if (!secret) return null;

        // Recompute expected HMAC-SHA256 over header.payload
        const signingInput = `${headerB64}.${payloadB64}`;
        const expectedSigBytes = createHmac('sha256', secret).update(signingInput).digest();
        const actualSigBytes = base64urlToBuffer(signatureB64);

        if (expectedSigBytes.length !== actualSigBytes.length) return null;
        if (!timingSafeEqual(expectedSigBytes, actualSigBytes)) return null;

        // Decode and parse claims
        const payloadJson = base64urlToBuffer(payloadB64).toString('utf8');
        const claims: unknown = JSON.parse(payloadJson);

        if (!isWaiverTokenPayload(claims)) return null;

        // Enforce 15-minute window
        const now = Date.now();
        if (claims.issuedAt > now) return null;               // issued in the future
        if (claims.expiresAt < now) return null;               // expired
        if (now - claims.issuedAt > 15 * 60 * 1000) return null; // older than 15 min

        return claims;
    } catch {
        return null;
    }
}

// ─── Run seed derivation ───────────────────────────────────────────────────

export function deriveRunSeed(runId: string, organizationId: string): number {
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    return Number.parseInt(digest.slice(0, 8), 16);
}

// ─── Per-operator Temporal task-queue resolution ──────────────────────────

/**
 * A Moat-pulls deployment gives each operator their own Temporal task queue
 * on the shared cluster: their `docker-compose.moat.yml` (or the cloud-
 * connected variant) worker long-polls that queue only, so one operator's
 * Moat host never receives another organization's run. That per-operator
 * isolation is an explicit opt-in via OMNIPORT_TASK_QUEUE_PREFIX — an
 * operator sets it, then configures their own worker's TEMPORAL_TASK_QUEUE
 * to `${prefix}-<organizationId>` per docker-compose.moat.cloud.yml's own
 * instructions. Without that opt-in, this is a single shared deployment
 * with one worker polling one fixed queue (see api-server.ts's
 * TEMPORAL_TASK_QUEUE, used identically by /api/run and the pending-run
 * dispatcher) — computing a per-org queue here regardless would dispatch
 * onto a queue that worker never polls, silently orphaning the workflow
 * forever (confirmed live: the first-ever real OmniPort live-fire dispatch
 * against the shared armageddon-exec-api sat in 'running' indefinitely).
 */
export function resolveOmniPortTaskQueue(organizationId: string): string {
    const prefix = process.env.OMNIPORT_TASK_QUEUE_PREFIX?.trim();
    if (!prefix) return process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';
    const sanitizedOrgId = organizationId.replace(/[^A-Za-z0-9_-]/g, '');
    if (!sanitizedOrgId) return process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';
    return `${prefix}-${sanitizedOrgId}`;
}
