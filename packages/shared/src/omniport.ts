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

/**
 * Returns true if the resolved IPv4 dotted-decimal address falls within any
 * IANA-reserved, private, link-local, CGNAT, documentation, benchmarking,
 * multicast, or otherwise non-global-unicast range.
 *
 * Ranges covered (RFC-referenced):
 *   0.0.0.0/8        – "This" network (RFC 791)
 *   10.0.0.0/8       – Private (RFC 1918)
 *   100.64.0.0/10    – Carrier-grade NAT (RFC 6598)
 *   127.0.0.0/8      – Loopback (RFC 5735)
 *   169.254.0.0/16   – Link-local / cloud metadata (RFC 3927)
 *   172.16.0.0/12    – Private (RFC 1918)
 *   192.0.0.0/24     – IETF Protocol (RFC 5736)
 *   192.0.2.0/24     – TEST-NET-1 (RFC 5737)
 *   192.168.0.0/16   – Private (RFC 1918)
 *   198.18.0.0/15    – Benchmarking (RFC 2544)
 *   198.51.100.0/24  – TEST-NET-2 (RFC 5737)
 *   203.0.113.0/24   – TEST-NET-3 (RFC 5737)
 *   224.0.0.0/4      – Multicast (RFC 3171)
 *   240.0.0.0/4      – Reserved / future (RFC 1112)
 *   255.255.255.255  – Limited broadcast
 */
function isBlockedIPv4(address: string): boolean {
    const octets = address.split('.').map(Number) as [number, number, number, number];
    const [a, b, c] = octets;
    return (
        a === 0                                    ||  // 0/8
        a === 10                                   ||  // 10/8
        (a === 100 && b >= 64 && b <= 127)         ||  // 100.64/10 CGNAT
        a === 127                                  ||  // 127/8 loopback
        (a === 169 && b === 254)                   ||  // 169.254/16 link-local
        (a === 172 && b >= 16 && b <= 31)          ||  // 172.16/12
        (a === 192 && b === 0   && c === 0)        ||  // 192.0.0/24 IETF Protocol
        (a === 192 && b === 0   && c === 2)        ||  // 192.0.2/24 TEST-NET-1
        (a === 192 && b === 168)                   ||  // 192.168/16
        (a === 198 && b >= 18  && b <= 19)         ||  // 198.18/15 benchmarking
        (a === 198 && b === 51  && c === 100)      ||  // 198.51.100/24 TEST-NET-2
        (a === 203 && b === 0   && c === 113)      ||  // 203.0.113/24 TEST-NET-3
        a >= 224                                       // 224/4 multicast + 240/4 reserved + broadcast
    );
}

/**
 * Decodes an IPv4-mapped or IPv4-compatible IPv6 address and checks it against
 * the IPv4 block list.  Also rejects loopback, unspecified, unique-local,
 * link-local, documentation, discard, and multicast IPv6 ranges.
 *
 * IPv4-mapped:     ::ffff:a.b.c.d  /  ::ffff:0:a.b.c.d
 * IPv4-compatible: ::a.b.c.d  (deprecated, RFC 4291 §2.5.5.1)
 * IPv4-translated: 64:ff9b::/96  (RFC 6052)
 */
function isBlockedIPv6(address: string): boolean {
    const norm = address.toLowerCase();

    // Unspecified / loopback
    if (norm === '::' || norm === '::1') return true;

    // Unique-local (fc00::/7) — fc and fd prefix
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;

    // Link-local (fe80::/10) — fe8, fe9, fea, feb
    if (norm.startsWith('fe8') || norm.startsWith('fe9') ||
        norm.startsWith('fea') || norm.startsWith('feb')) return true;

    // Multicast (ff00::/8)
    if (norm.startsWith('ff')) return true;

    // Documentation (2001:db8::/32)
    if (norm.startsWith('2001:db8')) return true;

    // Discard (0100::/64)
    if (norm.startsWith('0100:') || norm.startsWith('100:')) return true;

    // Helper to decode 32-bit hex IPv4 address from two 16-bit hex chunks
    const parseIPv4Hex = (hiStr: string, loStr: string): string => {
        const hi = parseInt(hiStr, 16);
        const lo = parseInt(loStr, 16);
        return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    };

    // IPv4-mapped dot-decimal  ::ffff:<ipv4>  or  ::ffff:0:<ipv4>
    const mappedMatch = norm.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedMatch) return isBlockedIPv4(mappedMatch[1]);

    // IPv4-mapped hex form  ::ffff:<ipv4-hex> or ::ffff:0:<ipv4-hex>
    const mappedHex = norm.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) return isBlockedIPv4(parseIPv4Hex(mappedHex[1], mappedHex[2]));

    // IPv4-compatible dot-decimal (deprecated)  ::<ipv4>
    const compatMatch = norm.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
    if (compatMatch) return isBlockedIPv4(compatMatch[1]);

    // IPv4-compatible hex form (deprecated)  ::<ipv4-hex>
    const compatHex = norm.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (compatHex) return isBlockedIPv4(parseIPv4Hex(compatHex[1], compatHex[2]));

    // 64:ff9b::/96 (NAT64, RFC 6052) — wraps real IPv4, conservatively block
    if (norm.startsWith('64:ff9b:')) return true;

    return false;
}

function isBlockedIpAddress(address: string): boolean {
    const ipVersion = isIP(address);
    if (ipVersion === 4) {
        const parsed = parseIPv4Address(address);
        if (!parsed) return true;
        return isBlockedIPv4(parsed);
    }
    if (ipVersion === 6) {
        return isBlockedIPv6(address);
    }
    // Not a recognized IP — block by default (fail-closed)
    return true;
}

/** Rejects loopback/private/link-local/multicast targets and non-http(s) schemes. */
export async function validateSSRF(url: string): Promise<boolean> {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

        // Reject URL userinfo (username or password in URL) — SSRF/CSRF vector
        if (parsed.username || parsed.password) return false;

        const hostname = parsed.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;

        const decodedHostname = decodeURIComponent(hostname);
        const directIPv4 = parseIPv4Address(decodedHostname);
        if (directIPv4) return !isBlockedIPv4(directIPv4);
        if (isIP(decodedHostname)) return !isBlockedIpAddress(decodedHostname);

        const results = await lookup(decodedHostname, { all: true, verbatim: true });
        // Zero addresses — reject (DNS failure or NXDOMAIN)
        if (results.length === 0) return false;
        // ALL resolved addresses must pass — one private address among many rejects all
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
    // Pad to equal length before timing-safe compare to avoid length oracle
    const keyBuf = Buffer.from(apiKey, 'utf8');
    const tokBuf = Buffer.from(token, 'utf8');
    if (keyBuf.length !== tokBuf.length) return false;
    return timingSafeEqual(keyBuf, tokBuf);
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
 * Moat host never receives another organization's run. Falls back to the
 * single shared queue when no organizationId is available (e.g. the
 * simulation-only public console path, which never reaches an operator Moat
 * host).
 */
export function resolveOmniPortTaskQueue(organizationId: string): string {
    const prefix = process.env.OMNIPORT_TASK_QUEUE_PREFIX?.trim() || 'armageddon-moat';
    const sanitizedOrgId = organizationId.replace(/[^A-Za-z0-9_-]/g, '');
    if (!sanitizedOrgId) return process.env.TEMPORAL_TASK_QUEUE || 'armageddon-level-7';
    return `${prefix}-${sanitizedOrgId}`;
}
