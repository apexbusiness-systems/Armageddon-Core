// armageddon-site/src/lib/omniport.ts
// OmniPort server-side auth utilities: token verification, HMAC signing, JWT waiver validation.
// All comparisons use timing-safe equality. No secrets ever leave this module.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { type NextRequest, NextResponse } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import dns from 'node:dns/promises';
import net from 'node:net';

// ─── SSRF Validation Helper ────────────────────────────────────────────────
export function isPrivateIP(ip: string): boolean {
    let targetIp = ip.trim();
    if (targetIp.startsWith('::ffff:')) {
        targetIp = targetIp.substring(7);
    }

    if (net.isIPv4(targetIp)) {
        const parts = targetIp.split('.').map(Number);
        if (parts.length !== 4) return true;
        const [p1, p2, p3, p4] = parts;
        
        if (p1 === 127) return true;
        if (p1 === 10) return true;
        if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
        if (p1 === 192 && p2 === 168) return true;
        if (p1 === 169 && p2 === 254) return true;
        if (p1 === 0) return true;
        
        return false;
    } else if (net.isIPv6(targetIp)) {
        const lower = targetIp.toLowerCase();
        if (lower === '::1' || lower === '0:0:0:0:0:0:0:1' || lower === '::0.0.0.1') return true;
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
        if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
        return false;
    }
    return true;
}

export function tryNormalizeIPv4(hostname: string): string | null {
    const host = hostname.toLowerCase().trim();
    
    if (host.startsWith('0x')) {
        const hexVal = host.slice(2);
        if (/^[0-9a-f]+$/.test(hexVal)) {
            const num = parseInt(hexVal, 16);
            if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
                return `${(num >> 24) & 255}.${(num >> 16) & 255}.${(num >> 8) & 255}.${num & 255}`;
            }
        }
    }
    
    if (host.startsWith('0') && host.length > 1 && !host.startsWith('0x')) {
        if (/^[0-7]+$/.test(host)) {
            const num = parseInt(host, 8);
            if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
                return `${(num >> 24) & 255}.${(num >> 16) & 255}.${(num >> 8) & 255}.${num & 255}`;
            }
        }
    }
    
    if (/^[0-9]+$/.test(host)) {
        const num = parseInt(host, 10);
        if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
            return `${(num >> 24) & 255}.${(num >> 16) & 255}.${(num >> 8) & 255}.${num & 255}`;
        }
    }
    
    const parts = host.split('.');
    if (parts.length > 0 && parts.length <= 4) {
        const parsedParts: number[] = [];
        for (const part of parts) {
            let val: number;
            if (part.startsWith('0x')) {
                val = parseInt(part.slice(2), 16);
            } else if (part.startsWith('0') && part.length > 1) {
                val = parseInt(part, 8);
            } else {
                val = parseInt(part, 10);
            }
            if (isNaN(val) || val < 0 || val > 255) {
                return null;
            }
            parsedParts.push(val);
        }
        if (parsedParts.length === 1) {
            const num = parsedParts[0];
            return `${(num >> 24) & 255}.${(num >> 16) & 255}.${(num >> 8) & 255}.${num & 255}`;
        } else if (parsedParts.length === 2) {
            const [p1, p2] = parsedParts;
            return `${p1}.0.0.${p2}`;
        } else if (parsedParts.length === 3) {
            const [p1, p2, p3] = parsedParts;
            return `${p1}.${p2}.0.${p3}`;
        } else if (parsedParts.length === 4) {
            return parsedParts.join('.');
        }
    }
    
    return null;
}

export async function validateSSRF(url: string): Promise<boolean> {
    try {
        const parsed = new URL(url);
        
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }

        const hostname = parsed.hostname.toLowerCase().trim();
        
        if (hostname === 'localhost') {
            return false;
        }

        const normalizedIp = tryNormalizeIPv4(hostname);
        if (normalizedIp) {
            if (isPrivateIP(normalizedIp)) return false;
        }

        let checkIp = hostname;
        if (checkIp.startsWith('[') && checkIp.endsWith(']')) {
            checkIp = checkIp.slice(1, -1);
        }
        if (net.isIPv6(checkIp)) {
            if (isPrivateIP(checkIp)) return false;
        }

        try {
            const addresses = await dns.resolve(hostname).catch(async () => {
                const lookupRes = await dns.lookup(hostname, { all: true });
                return lookupRes.map(r => r.address);
            });
            
            for (const addr of addresses) {
                if (isPrivateIP(addr)) {
                    return false;
                }
            }
        } catch {
            return false;
        }

        const results = await lookup(decodedHostname, { all: true, verbatim: true });
        if (results.length === 0) return false;
        return results.every(result => !isBlockedIpAddress(result.address));
    } catch {
        return false;
    }
}

// ─── WaiverTokenPayload (mirrored from packages/core/src/omniport/types.ts) ─
// armageddon-core is not a workspace dep of armageddon-site; types are defined here locally.

export const WaiverTokenPayloadSchema = z.object({
    orgId: z.string().min(1),
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
    runLevel: z.number().int().min(1).max(7),
    acceptedByUserId: z.string().min(1),
    waiverVersion: z.literal('1.0'),
});
export type WaiverTokenPayload = z.infer<typeof WaiverTokenPayloadSchema>;

// ─── Zod schemas for route I/O boundaries ─────────────────────────────────

export const OmniPortExecuteRequestSchema = z.object({
    organizationId: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
    omniPortToken: z.string().min(1),
    targetUrl: z.string().url().refine(async (val) => await validateSSRF(val), { message: 'SSRF_BLOCKED' }),
});
export type OmniPortExecuteRequest = z.infer<typeof OmniPortExecuteRequestSchema>;

export const OmniPortControlCommandSchema = z.object({
    command: z.enum(['pause', 'resume', 'cancel', 'adjust_iterations', 'inject_battery']),
    runId: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
});
export type OmniPortControlCommand = z.infer<typeof OmniPortControlCommandSchema>;

export const OmniPortLiveFireRequestSchema = z.object({
    organizationId: z.string().min(1),
    waiverToken: z.string().min(1),
    level: z.number().int().min(1).max(7),
    iterations: z.number().int().positive(),
    batteries: z.array(z.string()).optional(),
    targetUrl: z.string().url().refine(async (val) => await validateSSRF(val), { message: 'SSRF_BLOCKED' }),
});
export type OmniPortLiveFireRequest = z.infer<typeof OmniPortLiveFireRequestSchema>;

export const WaiverRecordRequestSchema = z.object({
    waiverToken: z.string().min(1),
    acceptedByUserId: z.string().min(1),
    organizationId: z.string().min(1),
});
export type WaiverRecordRequest = z.infer<typeof WaiverRecordRequestSchema>;

// ─── OMNIPORT_ENABLED guard ────────────────────────────────────────────────

export function isOmniPortEnabled(): boolean {
    return process.env.OMNIPORT_ENABLED === 'true';
}

/**
 * Combined auth guard for all OmniPort routes.
 * Returns a NextResponse (503 or 401) if the request should be rejected,
 * or null if both checks pass and the route may proceed.
 */
export function guardOmniPort(request: NextRequest): NextResponse | null {
    if (!isOmniPortEnabled()) {
        return NextResponse.json(
            { success: false, error: 'OmniPort connector is disabled on this instance', code: 'OMNIPORT_DISABLED' },
            { status: 503 }
        );
    }
    if (!verifyOmniPortToken(request)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }
    return null;
}

// ─── Bearer token verification ─────────────────────────────────────────────

export function verifyOmniPortToken(request: NextRequest): boolean {
    const authHeader = request.headers.get('Authorization');
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

function base64urlToBuffer(str: string): Buffer {
    // Convert base64url → base64 → Buffer
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((str.length + 3) % 4 || 4);
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

        const parsed = WaiverTokenPayloadSchema.safeParse(claims);
        if (!parsed.success) return null;

        // Enforce 15-minute window
        const now = Date.now();
        if (parsed.data.issuedAt > now) return null;               // issued in the future
        if (parsed.data.expiresAt < now) return null;               // expired
        if (now - parsed.data.issuedAt > 15 * 60 * 1000) return null; // older than 15 min

        return parsed.data;
    } catch {
        return null;
    }
}

// ─── Run seed derivation ───────────────────────────────────────────────────

export function deriveRunSeed(runId: string, organizationId: string): number {
    const digest = createHash('sha256').update(`${organizationId}:${runId}`).digest('hex');
    return Number.parseInt(digest.slice(0, 8), 16);
}

// ─── Body parsing + Zod validation helper ─────────────────────────────────

/**
 * Parses the JSON request body and validates it against a Zod schema.
 * Returns the validated data, or a NextResponse with the appropriate error.
 */
export async function parseOmniPortBody<T>(
    request: NextRequest,
    schema: z.ZodType<T>
): Promise<T | NextResponse> {
    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' },
            { status: 400 }
        );
    }
    const result = await schema.safeParseAsync(rawBody);
    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error.issues[0]?.message ?? 'Validation failed', code: 'VALIDATION_ERROR' },
            { status: 400 }
        );
    }
    return result.data;
}

// ─── Telemetry persistence helper ─────────────────────────────────────────

/**
 * Writes a telemetry event to the omniport_telemetry_events Supabase table.
 *
 * Default is fail-silent (logs on error, never throws) for non-critical telemetry.
 * Pass { required: true } for proof-critical events (e.g. live_fire.authorized):
 * the insert failure then throws so the caller must not report success without
 * durable proof in the database.
 */
export async function persistTelemetryEvent(
    supabase: SupabaseClient,
    runId: string,
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    opts: { required?: boolean } = {}
): Promise<void> {
    try {
        const timestamp = Date.now();
        const { error } = await supabase.from('omniport_telemetry_events').insert({
            run_id: runId,
            org_id: orgId,
            event_type: eventType,
            payload,
            timestamp,
        });
        if (error) {
            if (opts.required) {
                throw new Error(`Required telemetry '${eventType}' failed to persist: ${error.message}`);
            }
            console.warn('[OmniPort] Telemetry DB write failed (non-fatal):', error.message);
        }
    } catch (err) {
        if (opts.required) throw err;
        console.error('[OmniPort] Telemetry error (non-fatal):', (err as Error).message);
    }
}
